// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.WebUtilities;

namespace Jellyfin.Api.Security;

/// <summary>Opaque, short-lived authorization for one image; not a Jellyfin API token.</summary>
internal sealed class ImageGrantProtector(TimeProvider clock)
{
    public const string Prefix = "mag5_";
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private readonly byte[] _key = RandomNumberGenerator.GetBytes(32);
    private static readonly byte[] Purpose = Encoding.UTF8.GetBytes("MediaAccessGuard.SingleImage.v1");

    public string Create(Guid userId, Guid itemId, ImageType type, int index, string tag, string token, string deviceId, bool allowHttp)
    {
        if (userId.Equals(Guid.Empty) || itemId.Equals(Guid.Empty) || !Enum.IsDefined(type)
            || index is < 0 or > 999 || tag.Length is 0 or > 256
            || deviceId.Length is 0 or > 128 || !ValidToken(token))
        {
            throw new ArgumentException("Invalid image grant scope.");
        }

        var grant = new Grant(userId, itemId, type, index, tag, token, deviceId, clock.GetUtcNow().Add(Lifetime).ToUnixTimeSeconds(), allowHttp);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(grant);
        var output = new byte[28 + plaintext.Length];
        RandomNumberGenerator.Fill(output.AsSpan(0, 12));
        try
        {
            using var cipher = new AesGcm(_key, 16);
            cipher.Encrypt(output.AsSpan(0, 12), plaintext, output.AsSpan(28), output.AsSpan(12, 16), Purpose);
            return Prefix + WebEncoders.Base64UrlEncode(output);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public bool TryRead(string? value, out Grant? grant)
    {
        grant = null;
        if (value is null || !value.StartsWith(Prefix, StringComparison.Ordinal) || value.Length > 2048)
        {
            return false;
        }

        byte[]? plaintext = null;
        try
        {
            var bytes = WebEncoders.Base64UrlDecode(value[Prefix.Length..]);
            if (bytes.Length < 29)
            {
                return false;
            }

            plaintext = new byte[bytes.Length - 28];
            using var cipher = new AesGcm(_key, 16);
            cipher.Decrypt(bytes.AsSpan(0, 12), bytes.AsSpan(28), bytes.AsSpan(12, 16), plaintext, Purpose);
            var decoded = JsonSerializer.Deserialize<Grant>(plaintext);
            var now = clock.GetUtcNow().ToUnixTimeSeconds();
            if (decoded is null || decoded.UserId.Equals(Guid.Empty) || decoded.ItemId.Equals(Guid.Empty)
                || !Enum.IsDefined(decoded.Type) || decoded.Index is < 0 or > 999
                || decoded.Expires <= now || decoded.Expires > now + (long)Lifetime.TotalSeconds
                || decoded.DeviceId is not { Length: > 0 and <= 128 }
                || decoded.OriginalTag is not { Length: > 0 and <= 256 } || !ValidToken(decoded.Token))
            {
                return false;
            }

            grant = decoded;
            return true;
        }
        catch (Exception error) when (error is FormatException or CryptographicException or ArgumentException or JsonException)
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

    private static bool ValidToken(string? token) => token is { Length: > 0 and <= 512 }
        && !token.Any(c => c is '\r' or '\n' or '"' or '\\');

    public sealed record Grant(Guid UserId, Guid ItemId, ImageType Type, int Index,
        string OriginalTag, string Token, string DeviceId, long Expires, bool AllowHttp)
    {
        public override string ToString() => "Scoped image capability";
    }
}
