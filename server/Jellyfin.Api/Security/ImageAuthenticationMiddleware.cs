// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Primitives;

namespace Jellyfin.Api.Security;

internal sealed class ImageAuthenticationMiddleware(RequestDelegate next,
    IServerConfigurationManager configuration, ImageSessionCookie cookies, ImageGrantProtector grants)
{
    public static readonly object CookieAuthentication = new();
    public static readonly object GrantAuthentication = new();

    public async Task InvokeAsync(HttpContext http)
    {
        // This comes from Jellyfin's saved configuration, never Host/Forwarded.
        var prefix = (configuration.GetConfiguration("network") as NetworkConfiguration)?.BaseUrl.TrimEnd('/') ?? string.Empty;
        var path = http.Request.Path;
        if (prefix.Length > 0 && path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase, out var remainder))
        {
            path = remainder;
        }
        else if (prefix.Length > 0 && !http.Request.PathBase.Equals(new PathString(prefix), StringComparison.OrdinalIgnoreCase))
        {
            await next(http);
            return;
        }

        var segments = (path.Value ?? string.Empty).Split('/', StringSplitOptions.RemoveEmptyEntries);
        var image = (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method))
            && segments.Length >= 4 && segments[2].Equals("Images", StringComparison.OrdinalIgnoreCase)
            && new[] { "Items", "Artists", "Genres", "MusicGenres", "Persons", "Studios" }
                .Contains(segments[0], StringComparer.OrdinalIgnoreCase);
        var explicitCredentials = http.Request.Headers.ContainsKey("Authorization")
            || http.Request.Headers.ContainsKey("X-Emby-Authorization")
            || http.Request.Headers.ContainsKey("X-Emby-Token")
            || http.Request.Headers.ContainsKey("X-MediaBrowser-Token")
            || http.Request.Query.Keys.Any(key => key.Equals("api_key", StringComparison.OrdinalIgnoreCase)
                || key.Equals("ApiKey", StringComparison.OrdinalIgnoreCase));

        if (image && !explicitCredentials && segments.Length is 4 or 5
            && segments[0].Equals("Items", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(segments[1], out var itemId)
            && Enum.TryParse<ImageType>(segments[3], true, out var type) && Enum.IsDefined(type)
            && TryImageIndex(segments, http.Request.Query, out var imageIndex)
            && !http.Request.Query.Keys.Any(key => new[] { "itemId", "routeItemId", "imageType" }.Contains(key, StringComparer.OrdinalIgnoreCase))
            && http.Request.Query.TryGetValue("tag", out var tags) && tags.Count == 1
            && grants.TryRead(tags[0], out var grant) && grant is not null
            && grant.ItemId.Equals(itemId) && grant.Type == type
            && grant.Index == imageIndex)
        {
            // Only an exact image scope can recover the native session token.
            // Native authentication and the image rights filter still run.
            http.Items[GrantAuthentication] = grant;
            http.Request.Headers.Authorization = "MediaBrowser Token=\"" + grant.Token + "\"";
            var query = http.Request.Query.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);
            query["tag"] = new StringValues(grant.OriginalTag);
            http.Request.Query = new QueryCollection(query);
        }
        else if (image && !explicitCredentials && cookies.TryRead(http.Request.Cookies[cookies.Name], out var token))
        {
            http.Items[CookieAuthentication] = true;
            http.Request.Headers.Authorization = "MediaBrowser Token=\"" + token + "\"";
        }

        http.Response.OnStarting(() =>
        {
            if (image)
            {
                // Override native public image caching after the file action
                // sets its headers. Also applies to 401/403/304 responses.
                http.Response.Headers.CacheControl = "private, no-store";
                http.Response.Headers.Pragma = "no-cache";
                http.Response.Headers.Expires = "0";
                var vary = http.Response.Headers.Vary.ToString();
                http.Response.Headers.Vary = string.IsNullOrEmpty(vary) ? "Authorization, Cookie" : vary + ", Authorization, Cookie";
            }

            var options = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = prefix + "/",
                MaxAge = ImageSessionCookie.Lifetime,
                IsEssential = true
            };
            if (path.Equals(new PathString("/Sessions/Logout"), StringComparison.OrdinalIgnoreCase) && http.Response.StatusCode is >= 200 and < 300)
            {
                http.Response.Cookies.Delete(cookies.Name, options);
                return Task.CompletedTask;
            }

            // HTTPS is evaluated here, after Jellyfin processed trusted proxy
            // headers. Never issue this credential over internal plain HTTP.
            if (!image && explicitCredentials && http.Request.IsHttps
                && http.Response.StatusCode is >= 200 and < 300
                && http.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>() is { } action
                && action.ControllerTypeInfo.Assembly.GetName().Name == "Jellyfin.Api"
                && http.User.Identity?.IsAuthenticated == true
                && Guid.TryParse(http.User.FindFirst("Jellyfin-UserId")?.Value, out var userId) && !userId.Equals(Guid.Empty)
                && http.User.FindFirst("Jellyfin-Token")?.Value is { Length: > 0 and <= 512 } currentToken)
            {
                http.Response.Cookies.Append(cookies.Name, cookies.Create(currentToken), options);
                http.Response.Headers.CacheControl = "no-store";
            }

            return Task.CompletedTask;
        });

        await next(http);
    }

    private static bool TryImageIndex(string[] segments, IQueryCollection query, out int index)
    {
        index = 0;
        if (segments.Length == 5 && (!int.TryParse(segments[4], NumberStyles.None, CultureInfo.InvariantCulture, out index)
            || index is < 0 or > 999))
        {
            return false;
        }

        // The 0.19.10 SDK passes Backdrop indexes in the query, not the route.
        // Authorize that effective index; reject ambiguity on indexed routes.
        if (query.TryGetValue("imageIndex", out var values))
        {
            if (values.Count != 1 || !int.TryParse(values[0], NumberStyles.None, CultureInfo.InvariantCulture, out var requested)
                || requested is < 0 or > 999 || (segments.Length == 5 && requested != index))
            {
                return false;
            }

            index = requested;
        }

        return true;
    }
}
