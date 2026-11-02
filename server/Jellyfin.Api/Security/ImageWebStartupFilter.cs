// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Api.Security;

internal sealed class ImageWebStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.UseMiddleware<ImageWebMiddleware>();
        next(app);
    };
}
