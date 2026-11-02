// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.WebUtilities;

namespace Jellyfin.Api.Security;

/// <summary>
/// Opaque five-minute image-only credential, never accepted as a Jellyfin token.
/// The process-local key deliberately invalidates cookies on a server restart.
/// The enclosed native token is decrypted in memory only, then revalidated by
/// Jellyfin's own authentication handler on every image request.
/// </summary>
internal sealed class ImageSessionCookie(string serverId, TimeProvider clock)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private readonly byte[] _key = RandomNumberGenerator.GetBytes(32);
    private static readonly byte[] Purpose = Encoding.UTF8.GetBytes("MediaAccessGuard.Images.v1");

    public string Name { get; } = "__Secure-JellyfinImages-" +
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serverId)))[..12];

    public string Create(string token)
    {
        var plaintext = new byte[8 + Encoding.UTF8.GetByteCount(token)];
        BinaryPrimitives.WriteInt64BigEndian(plaintext, clock.GetUtcNow().Add(Lifetime).ToUnixTimeSeconds());
        Encoding.UTF8.GetBytes(token, plaintext.AsSpan(8));
        var output = new byte[12 + 16 + plaintext.Length];
        RandomNumberGenerator.Fill(output.AsSpan(0, 12));
        try
        {
            using var cipher = new AesGcm(_key, 16);
            cipher.Encrypt(output.AsSpan(0, 12), plaintext, output.AsSpan(28), output.AsSpan(12, 16), Purpose);
            return WebEncoders.Base64UrlEncode(output);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public bool TryRead(string? value, out string token)
    {
        token = string.Empty;
        if (string.IsNullOrEmpty(value) || value.Length > 2048)
        {
            return false;
        }

        byte[]? plaintext = null;
        try
        {
            var bytes = WebEncoders.Base64UrlDecode(value);
            if (bytes.Length < 37)
            {
                return false;
            }

            plaintext = new byte[bytes.Length - 28];
            using var cipher = new AesGcm(_key, 16);
            cipher.Decrypt(bytes.AsSpan(0, 12), bytes.AsSpan(28), bytes.AsSpan(12, 16), plaintext, Purpose);
            var expiry = BinaryPrimitives.ReadInt64BigEndian(plaintext);
            var now = clock.GetUtcNow().ToUnixTimeSeconds();
            if (expiry <= now || expiry > now + (long)Lifetime.TotalSeconds)
            {
                return false;
            }

            token = Encoding.UTF8.GetString(plaintext.AsSpan(8));
            return token.Length is > 0 and <= 512 && !token.Any(c => c is '\r' or '\n' or '"' or '\\');
        }
        catch (Exception error) when (error is FormatException or CryptographicException or ArgumentException)
        {
            return false;
        }
        finally
        {
            if (plaintext is not null)
            {
                CryptographicOperations.ZeroMemory(plaintext);
            }
        }
    }
}
