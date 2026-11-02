// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Jellyfin.Api.Security;

/// <summary>
/// Runs inside MVC after Jellyfin's authentication and forwarded-header middleware.
/// Scope uses the resolved action, so aliases, extensions, HEAD, BaseUrl and casing
/// cannot sidestep a textual URL pattern. Existing authorization remains in place.
/// </summary>
internal sealed class MediaAuthorizationFilter(
    IAuthorizationPolicyProvider policyProvider,
    IAuthorizationService authorization,
    ILibraryManager library,
    IUserManager users,
    IMediaSourceManager sources) : IAsyncAuthorizationFilter
{
    private static readonly HashSet<string> MediaControllers = new(StringComparer.Ordinal)
    {
        "Videos", "Audio", "UniversalAudio", "DynamicHls", "HlsSegment",
        "Subtitle", "VideoAttachments", "Trickplay", "Lyrics"
    };

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action
            || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
            || !(MediaControllers.Contains(action.ControllerName)
                || (action.ControllerName == "Library" && action.ActionName is "GetFile" or "GetDownload")
                || (action.ControllerName == "MediaInfo" && action.ActionName is "GetPlaybackInfo" or "GetPostedPlaybackInfo")
                || (action.ControllerName == "LiveTv" && action.ActionName is "GetLiveRecordingFile" or "GetLiveStreamFile")))
        {
            return;
        }

        var http = context.HttpContext;
        http.Response.Headers.CacheControl = "no-store";
        if (http.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Jellyfin's handler has already checked token validity and disabled
        // accounts. Apply its default policy as well (remote access/schedules).
        var policy = await policyProvider.GetDefaultPolicyAsync().ConfigureAwait(false);
        var result = await authorization.AuthorizeAsync(http.User, http, policy).ConfigureAwait(false);
        if (!result.Succeeded)
        {
            context.Result = new ForbidResult();
            return;
        }

        // A library authorization decision requires a personal user. An
        // application API key without a user is not a media-library grant.
        if (!Guid.TryParse(http.User.FindFirst("Jellyfin-UserId")?.Value, out var userId)
            || userId.Equals(Guid.Empty) || users.GetUserById(userId) is not { } user)
        {
            context.Result = new ForbidResult();
            return;
        }

        // These old raw-file routes ignore itemId when selecting a cached
        // transcode or live stream. A claimed, permitted item is insufficient
        // evidence of ownership of that file. Until a trustworthy association
        // is available they fail closed; modern hls1 routes remain supported.
        if (action.ControllerName == "LiveTv"
            || (action.ControllerName == "HlsSegment" && action.ActionName is
                "GetHlsVideoSegmentLegacy" or "GetHlsAudioSegmentLegacy" or "GetHlsPlaylistLegacy"))
        {
            context.Result = new ForbidResult();
            return;
        }

        var subtitleOverrides = action.ControllerName == "Subtitle"
            && action.ActionName is "GetSubtitle" or "GetSubtitleWithTicks";
        // Subtitle's legacy action explicitly lets query values override the
        // routeItemId / routeMediaSourceId defaults. Authorize the effective
        // values that the action uses, never an unrelated permitted route ID.
        var rawId = subtitleOverrides ? http.Request.Query["itemId"].ToString() : null;
        if (string.IsNullOrEmpty(rawId))
        {
            rawId = http.Request.RouteValues["itemId"]?.ToString()
            ?? http.Request.RouteValues["videoId"]?.ToString()
            ?? http.Request.RouteValues["routeItemId"]?.ToString();
        }

        if (rawId is null)
        {
            return; // Non-file actions retain their native policy.
        }

        if (!Guid.TryParse(rawId, out var itemId) || itemId.Equals(Guid.Empty))
        {
            context.Result = new BadRequestResult();
            return;
        }

        var item = library.GetItemById(itemId);
        if (item is null)
        {
            context.Result = new NotFoundResult();
            return;
        }

        if (!item.IsVisibleStandalone(user) || item.GetPlayAccess(user) == PlayAccess.None)
        {
            context.Result = new ForbidResult();
            return;
        }

        var sourceId = subtitleOverrides ? http.Request.Query["mediaSourceId"].ToString() : null;
        if (string.IsNullOrEmpty(sourceId))
        {
            sourceId = http.Request.RouteValues["mediaSourceId"]?.ToString()
            ?? http.Request.RouteValues["routeMediaSourceId"]?.ToString();
        }

        if (string.IsNullOrEmpty(sourceId))
        {
            sourceId = http.Request.Query["MediaSourceId"].ToString();
        }

        if (!string.IsNullOrEmpty(sourceId))
        {
            var allowedSources = await sources.GetPlaybackMediaSources(item, user, false, false, http.RequestAborted).ConfigureAwait(false);
            if (!allowedSources.Any(source => string.Equals(source.Id, sourceId, StringComparison.OrdinalIgnoreCase)))
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
