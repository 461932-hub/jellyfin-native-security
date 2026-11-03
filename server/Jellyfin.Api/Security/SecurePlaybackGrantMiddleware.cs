// Updated 2026-11-03: retain the authenticated TV user-session DeviceId.
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace Jellyfin.Api.Security;

internal sealed class SecurePlaybackGrantMiddleware(RequestDelegate next,
    SecurePlaybackGrantStore grants, IOptionsMonitor<SecureMediaOptions> options)
{
    internal static readonly object GrantAuthentication = new();

    public async Task InvokeAsync(HttpContext http)
    {
        if (!http.Request.Query.TryGetValue("PlaybackGrant", out var values))
        {
            await next(http).ConfigureAwait(false);
            return;
        }

        var configuration = options.CurrentValue;
        var segments = (http.Request.Path.Value ?? string.Empty).Split('/', StringSplitOptions.RemoveEmptyEntries);
        var query = http.Request.Query;
        var allowed = new[] { "PlaybackGrant", "Static", "MediaSourceId", "PlaySessionId" };
        var valid = configuration.EnableAndroidTvDirectPlay && configuration.TryGetPlaybackBase(out var configuredBase)
            && (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method))
            && segments.Length == 3 && segments[0].Equals("Videos", StringComparison.OrdinalIgnoreCase)
            && segments[2].Equals("stream", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(segments[1], out var itemId)
            && values.Count == 1 && grants.TryRead(values[0], out var grant) && grant is not null
            && grant.ItemId.Equals(itemId) && (http.Request.IsHttps
                || (configuration.AllowInsecureHttpPlayback && grant.AllowHttp))
            && (configuration.AndroidTvDeviceIds.Length == 0
                || configuration.AndroidTvDeviceIds.Contains(grant.DeviceId, StringComparer.Ordinal))
            && query.Keys.All(key => allowed.Contains(key, StringComparer.OrdinalIgnoreCase))
            && query.TryGetValue("Static", out var isStatic) && isStatic.Count == 1
            && isStatic[0]?.Equals("true", StringComparison.OrdinalIgnoreCase) == true
            && query.TryGetValue("MediaSourceId", out var source) && source.Count == 1 && source[0] == grant.SourceId
            && query.TryGetValue("PlaySessionId", out var session) && session.Count == 1 && session[0] == grant.PlaySessionId
            && !http.Request.Headers.ContainsKey("Authorization")
            && !http.Request.Headers.ContainsKey("X-Emby-Authorization")
            && !http.Request.Headers.ContainsKey("X-Emby-Token")
            && !http.Request.Headers.ContainsKey("X-MediaBrowser-Token");

        if (!valid || !grants.TryRead(values[0], out var accepted) || accepted is null)
        {
            http.Response.StatusCode = StatusCodes.Status401Unauthorized;
            http.Response.Headers.CacheControl = "no-store";
            return;
        }

        // The native handler still validates the real session, revocation and
        // account status. A separate MVC filter binds the resulting identity.
        http.Items[GrantAuthentication] = accepted;
        // Android TV derives a user-specific DeviceId after login. Preserve the
        // identity bound to the grant instead of falling back to the token's
        // original login DeviceId. The native handler still validates the token.
        http.Request.Headers.Authorization = "MediaBrowser Token=\"" + accepted.Token
            + "\", DeviceId=\"" + accepted.DeviceId + "\"";
        http.Response.OnStarting(() =>
        {
            http.Response.Headers.CacheControl = "private, no-store";
            http.Response.Headers.Pragma = "no-cache";
            http.Response.Headers.Expires = "0";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
            return Task.CompletedTask;
        });
        await next(http).ConfigureAwait(false);
    }
}
