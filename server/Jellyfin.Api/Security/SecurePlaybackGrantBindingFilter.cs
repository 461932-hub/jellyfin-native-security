using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Jellyfin.Api.Security;

internal sealed class SecurePlaybackGrantBindingFilter : IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        if (http.Items.TryGetValue(SecurePlaybackGrantMiddleware.GrantAuthentication, out var value)
            && value is SecurePlaybackGrantStore.Grant grant
            && (context.ActionDescriptor is not ControllerActionDescriptor action
                || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
                || action.ControllerName != "Videos" || action.ActionName != "GetVideoStream"
                || http.User.Identity?.IsAuthenticated != true
                || !Guid.TryParse(http.User.FindFirst("Jellyfin-UserId")?.Value, out var userId)
                || !userId.Equals(grant.UserId)
                || http.User.FindFirst("Jellyfin-Token")?.Value != grant.Token
                || http.User.FindFirst("Jellyfin-DeviceId")?.Value != grant.DeviceId))
        {
            context.Result = new UnauthorizedResult();
        }

        return Task.CompletedTask;
    }
}
