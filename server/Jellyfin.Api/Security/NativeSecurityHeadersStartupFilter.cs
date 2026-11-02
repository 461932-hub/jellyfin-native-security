using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Api.Security;

internal sealed class NativeSecurityHeadersStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (http, continuation) =>
        {
            http.Response.OnStarting(() =>
            {
                var headers = http.Response.Headers;
                headers.TryAdd("X-Jellyfin-Media-Security", "native-preview-1");
                headers.TryAdd("X-Content-Type-Options", "nosniff");
                headers.TryAdd("X-Frame-Options", "SAMEORIGIN");
                headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
                headers.TryAdd("Content-Security-Policy", "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
                return Task.CompletedTask;
            });
            await continuation(http).ConfigureAwait(false);
        });
        next(app);
    };
}
