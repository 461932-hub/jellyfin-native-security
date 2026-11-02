using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Jellyfin.Api.Security;

/// <summary>
/// Process-local capabilities for one original media source. Only authenticated
/// playback progress can renew them; reading a capability never extends its life.
/// </summary>
internal sealed class SecurePlaybackGrantStore(TimeProvider clock)
{
    internal const string Prefix = "jfmp_";
    internal static readonly TimeSpan IdleLifetime = TimeSpan.FromMinutes(10);
    internal static readonly TimeSpan MaximumLifetime = TimeSpan.FromHours(8);
    private const int UserLimit = 32;
    private const int GlobalLimit = 4096;
    private readonly object _gate = new();
    private readonly Dictionary<string, Grant> _grants = new(StringComparer.Ordinal);

    internal string? Create(Guid userId, Guid itemId, string sourceId, string playSessionId, string deviceId, string token, bool allowHttp)
    {
        if (userId.Equals(Guid.Empty) || itemId.Equals(Guid.Empty)
            || !ValidValue(sourceId, 128) || !ValidValue(playSessionId, 128)
            || !ValidValue(deviceId, 128) || !ValidValue(token, 512))
        {
            return null;
        }

        lock (_gate)
        {
            var now = clock.GetUtcNow();
            RemoveExpired(now);
            if (_grants.Count >= GlobalLimit || _grants.Values.Count(grant => grant.UserId.Equals(userId)) >= UserLimit)
            {
                return null;
            }

            var handle = Prefix + WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
            _grants.Add(Hash(handle), new Grant
            {
                UserId = userId,
                ItemId = itemId,
                SourceId = sourceId,
                PlaySessionId = playSessionId,
                DeviceId = deviceId,
                Token = token,
                AllowHttp = allowHttp,
                MaximumExpiry = now.Add(MaximumLifetime),
                Expires = now.Add(IdleLifetime),
            });
            return handle;
        }
    }

    internal bool TryRead(string? handle, out Grant? grant)
    {
        grant = null;
        if (handle is null || handle.Length != Prefix.Length + 43 || !handle.StartsWith(Prefix, StringComparison.Ordinal)
            || handle.Skip(Prefix.Length).Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_'))
        {
            return false;
        }

        lock (_gate)
        {
            var now = clock.GetUtcNow();
            var key = Hash(handle);
            if (!_grants.TryGetValue(key, out var found))
            {
                return false;
            }

            if (found.Expires <= now || found.MaximumExpiry <= now)
            {
                _grants.Remove(key);
                return false;
            }

            grant = found;
            return true;
        }
    }

    internal void Report(Guid userId, Guid itemId, string sourceId, string playSessionId, string deviceId, string token, bool stopped)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            RemoveExpired(now);
            foreach (var pair in _grants.Where(pair => pair.Value.UserId.Equals(userId)
                && pair.Value.ItemId.Equals(itemId) && (string.IsNullOrEmpty(sourceId) || pair.Value.SourceId == sourceId)
                && pair.Value.PlaySessionId == playSessionId && pair.Value.DeviceId == deviceId
                && pair.Value.Token == token).ToArray())
            {
                if (stopped)
                {
                    _grants.Remove(pair.Key);
                }
                else
                {
                    var expiry = now.Add(IdleLifetime);
                    pair.Value.Expires = expiry < pair.Value.MaximumExpiry ? expiry : pair.Value.MaximumExpiry;
                }
            }
        }
    }

    private static bool ValidValue(string? value, int maximum) => value is { Length: > 0 }
        && value.Length <= maximum && !value.Any(c => char.IsControl(c) || c is '"' or '\\');

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private void RemoveExpired(DateTimeOffset now)
    {
        foreach (var key in _grants.Where(pair => pair.Value.Expires <= now || pair.Value.MaximumExpiry <= now)
            .Select(pair => pair.Key).ToArray())
        {
            _grants.Remove(key);
        }
    }

    internal sealed class Grant
    {
        internal required Guid UserId { get; init; }

        internal required Guid ItemId { get; init; }

        internal required string SourceId { get; init; }

        internal required string PlaySessionId { get; init; }

        internal required string DeviceId { get; init; }

        internal required string Token { get; init; }

        internal required bool AllowHttp { get; init; }

        internal required DateTimeOffset MaximumExpiry { get; init; }

        internal required DateTimeOffset Expires { get; set; }

        public override string ToString() => "Scoped playback capability";
    }
}
