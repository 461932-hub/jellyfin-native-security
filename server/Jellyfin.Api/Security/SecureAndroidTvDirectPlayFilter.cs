using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.MediaInfo;
using MediaBrowser.Model.Session;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace Jellyfin.Api.Security;

/// <summary>
/// Keep native negotiation intact. An already supported Direct Play source gets
/// a single-resource capability for the legacy TV client, not a session token.
/// </summary>
internal sealed class SecureAndroidTvDirectPlayFilter(SecurePlaybackGrantStore grants,
    IOptionsMonitor<SecureMediaOptions> options, ILibraryManager library) : IAsyncResultFilter, IAsyncActionFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        var http = context.HttpContext;
        var user = http.User;
        var configuration = options.CurrentValue;
        var client = user.FindFirst("Jellyfin-Client")?.Value;
        var device = user.FindFirst("Jellyfin-DeviceId")?.Value;
        if (!configuration.EnableAndroidTvDirectPlay || !configuration.TryGetPlaybackBase(out var baseUri)
            || baseUri is null || (!http.Request.IsHttps && !configuration.AllowInsecureHttpPlayback)
            || context.ActionDescriptor is not ControllerActionDescriptor action
            || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
            || action.ControllerName != "MediaInfo" || action.ActionName != "GetPostedPlaybackInfo"
            || user.Identity?.IsAuthenticated != true
            || !Guid.TryParse(user.FindFirst("Jellyfin-UserId")?.Value, out var userId) || userId.Equals(Guid.Empty)
            || !(string.Equals(client, "Jellyfin Android TV", StringComparison.OrdinalIgnoreCase)
                || string.Equals(client, "Jellyfin for Android TV", StringComparison.OrdinalIgnoreCase))
            || user.FindFirst("Jellyfin-Version")?.Value != "0.19.10"
            || user.FindFirst("Jellyfin-Token")?.Value is not { Length: > 0 } token
            || string.IsNullOrEmpty(device)
            || (configuration.AndroidTvDeviceIds.Length > 0
                && !configuration.AndroidTvDeviceIds.Contains(device, StringComparer.Ordinal))
            || context.Result is not ObjectResult { Value: PlaybackInfoResponse info }
            || info.ErrorCode is not null || string.IsNullOrEmpty(info.PlaySessionId)
            || !Guid.TryParse(http.Request.RouteValues["itemId"]?.ToString(), out var itemId)
            || library.GetItemById(itemId) is not Video)
        {
            await next().ConfigureAwait(false);
            return;
        }

        foreach (var source in info.MediaSources)
        {
            if (!source.SupportsDirectPlay || source.IsRemote || source.Protocol != MediaProtocol.File
                || source.IsInfiniteStream || source.RequiresOpening || string.IsNullOrEmpty(source.Id)
                || !source.MediaStreams.Any(stream => stream.Type == MediaStreamType.Video))
            {
                continue;
            }

            var handle = grants.Create(userId, itemId, source.Id, info.PlaySessionId, device, token, configuration.AllowInsecureHttpPlayback && baseUri.Scheme == Uri.UriSchemeHttp);
            if (handle is null)
            {
                continue;
            }

            source.Path = QueryHelpers.AddQueryString(
                baseUri.AbsoluteUri.TrimEnd('/') + "/Videos/" + itemId.ToString("N") + "/stream",
                new Dictionary<string, string?>
                {
                    ["Static"] = "true",
                    ["MediaSourceId"] = source.Id,
                    ["PlaySessionId"] = info.PlaySessionId,
                    ["PlaybackGrant"] = handle,
                });
            source.IsRemote = true;
            http.Response.Headers.CacheControl = "private, no-store";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
        }

        await next().ConfigureAwait(false);
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next().ConfigureAwait(false);
        var http = context.HttpContext;
        if (executed.Exception is not null || executed.Canceled
            || executed.Result is IStatusCodeActionResult { StatusCode: >= 300 }
            || http.Response.StatusCode >= 300
            || context.ActionDescriptor is not ControllerActionDescriptor action
            || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
            || action.ControllerName != "Playstate"
            || action.ActionName is not ("ReportPlaybackStart" or "ReportPlaybackProgress" or "ReportPlaybackStopped")
            || http.User.Identity?.IsAuthenticated != true
            || !Guid.TryParse(http.User.FindFirst("Jellyfin-UserId")?.Value, out var userId)
            || http.User.FindFirst("Jellyfin-Token")?.Value is not { Length: > 0 } token
            || http.User.FindFirst("Jellyfin-DeviceId")?.Value is not { Length: > 0 } device)
        {
            return;
        }

        foreach (var value in context.ActionArguments.Values)
        {
            if (value is PlaybackProgressInfo progress)
            {
                grants.Report(userId, progress.ItemId, progress.MediaSourceId, progress.PlaySessionId, device, token, false);
            }
            else if (value is PlaybackStopInfo stopped)
            {
                grants.Report(userId, stopped.ItemId, stopped.MediaSourceId, stopped.PlaySessionId, device, token, true);
            }
        }
    }
}
