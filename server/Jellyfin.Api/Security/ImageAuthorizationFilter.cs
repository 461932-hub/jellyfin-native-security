// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Jellyfin.Api.Security;

internal sealed class ImageAuthorizationFilter(IAuthorizationPolicyProvider policies,
    IAuthorizationService authorization, ILibraryManager library, IUserManager users, IOptionsMonitor<SecureMediaOptions> secureOptions) : IAsyncAuthorizationFilter
{
    private static readonly HashSet<string> ImageActions = new(StringComparer.Ordinal)
    {
        "GetItemImage", "GetItemImageByIndex", "GetItemImage2", "GetArtistImage",
        "GetGenreImage", "GetGenreImageByIndex", "GetMusicGenreImage", "GetMusicGenreImageByIndex",
        "GetPersonImage", "GetPersonImageByIndex", "GetStudioImage", "GetStudioImageByIndex"
    };

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action
            || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
            || action.ControllerName != "Image" || !ImageActions.Contains(action.ActionName))
        {
            return;
        }

        var http = context.HttpContext;
        http.Response.Headers.CacheControl = "private, no-store";
        if (http.User.Identity?.IsAuthenticated != true
            || (http.Items.ContainsKey(ImageAuthenticationMiddleware.CookieAuthentication) && !http.Request.IsHttps))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var policy = await policies.GetDefaultPolicyAsync().ConfigureAwait(false);
        if (!(await authorization.AuthorizeAsync(http.User, http, policy).ConfigureAwait(false)).Succeeded)
        {
            context.Result = new ForbidResult();
            return;
        }

        if (!Guid.TryParse(http.User.FindFirst("Jellyfin-UserId")?.Value, out var userId) || userId.Equals(Guid.Empty)
            || users.GetUserById(userId) is not { } user)
        {
            context.Result = new ForbidResult();
            return;
        }

        // Forwarded HTTPS has now been processed by Jellyfin. A private IP or
        // arbitrary Forwarded header never enables unencrypted image grants.
        if (http.Items.TryGetValue(ImageAuthenticationMiddleware.GrantAuthentication, out var accepted)
            && accepted is ImageGrantProtector.Grant grant
            && (!grant.UserId.Equals(userId) || secureOptions.CurrentValue is not { EnableAndroidTvImageCompatibility: true } config
                || (!http.Request.IsHttps && (!grant.AllowHttp || !config.AllowInsecureHttpImages))
                || (config.AndroidTvImageDeviceIds is { Length: > 0 } ids && !ids.Contains(grant.DeviceId, StringComparer.Ordinal))))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        BaseItem? item;
        if (http.Request.RouteValues["itemId"]?.ToString() is { } raw)
        {
            if (!Guid.TryParse(raw, out var id) || id.Equals(Guid.Empty))
            {
                context.Result = new BadRequestResult();
                return;
            }

            item = library.GetItemById(id);
        }
        else
        {
            var name = http.Request.RouteValues["name"]?.ToString();
            if (string.IsNullOrEmpty(name))
            {
                context.Result = new BadRequestResult();
                return;
            }

            item = action.ActionName switch
            {
                "GetArtistImage" => library.GetArtist(name),
                "GetGenreImage" or "GetGenreImageByIndex" => library.GetGenre(name),
                "GetMusicGenreImage" or "GetMusicGenreImageByIndex" => library.GetMusicGenre(name),
                "GetPersonImage" or "GetPersonImageByIndex" => library.GetPerson(name),
                "GetStudioImage" or "GetStudioImageByIndex" => library.GetStudio(name),
                _ => null
            };
        }

        if (item is null)
        {
            context.Result = new NotFoundResult();
            return;
        }

        if (!item.IsVisibleStandalone(user))
        {
            context.Result = new ForbidResult();
            return;
        }

        // By-name objects have no normal collection parent. Require at least
        // one tagged item from this user's visible library, including when the
        // same artist/genre/person/studio image is reached through its itemId.
        if (item is IItemByName named && !named.GetTaggedItems(new InternalItemsQuery(user)
        { Recursive = true, Limit = 1 }).Any(tagged => tagged.IsVisibleStandalone(user)))
        {
            context.Result = new ForbidResult();
        }

        // Viewing a permitted cover does not require permission to play media.
    }
}
