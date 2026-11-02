// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Api.Security;

internal sealed class ImageAuthenticationStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        // Before native authentication: no reimplementation of its validation,
        // revocation, disabled-account or claims handling is necessary.
        app.UseMiddleware<ImageAuthenticationMiddleware>();
        next(app);
    };
}
