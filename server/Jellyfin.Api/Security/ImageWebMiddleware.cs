// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Jellyfin.Api.Security;

/// <summary>Same-origin browser adapter; never transforms media/API documents.</summary>
internal sealed class ImageWebMiddleware(RequestDelegate next, IServerConfigurationManager configuration)
{
    public async Task InvokeAsync(HttpContext http)
    {
        var prefix = (configuration.GetConfiguration("network") as NetworkConfiguration)?.BaseUrl.TrimEnd('/') ?? string.Empty;
        var path = http.Request.Path;
        if (prefix.Length > 0 && path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase, out var rest))
        {
            path = rest;
        }
        else if (prefix.Length > 0 && !http.Request.PathBase.Equals(new PathString(prefix), StringComparison.OrdinalIgnoreCase))
        {
            await next(http);
            return;
        }

        if (path.Equals(new PathString("/MediaSecurity/image-client.js"), StringComparison.OrdinalIgnoreCase)
            && (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method)))
        {
            http.Response.ContentType = "application/javascript; charset=utf-8";
            http.Response.Headers.CacheControl = "no-cache";
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (HttpMethods.IsGet(http.Request.Method))
            {
                using var source = typeof(ImageWebMiddleware).Assembly.GetManifestResourceStream("Jellyfin.Api.Security.Web.image-client.js")!;
                await source.CopyToAsync(http.Response.Body, http.RequestAborted).ConfigureAwait(false);
            }

            return;
        }

        if (!HttpMethods.IsGet(http.Request.Method)
            || !(path.Equals(new PathString("/web/index.html"), StringComparison.OrdinalIgnoreCase) || path.Equals(new PathString("/web/"), StringComparison.OrdinalIgnoreCase)))
        {
            await next(http);
            return;
        }

        http.Request.Headers.Remove("Accept-Encoding");
        http.Request.Headers.Remove("If-None-Match");
        http.Request.Headers.Remove("If-Modified-Since");
        var original = http.Features.Get<IHttpResponseBodyFeature>();
        using var buffer = new MemoryStream();
        http.Features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(buffer));
        try
        {
            await next(http).ConfigureAwait(false);
        }
        finally
        {
            http.Features.Set(original);
        }

        var bytes = buffer.ToArray();
        if (http.Response.StatusCode == 200 && bytes.Length < 1048576
            && http.Response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) == true)
        {
            var html = Encoding.UTF8.GetString(bytes);
            var start = html.IndexOf("<head", StringComparison.OrdinalIgnoreCase);
            var head = start >= 0 ? html.IndexOf('>', start) : -1;
            if (head >= 0 && !html.Contains("id=\"media-access-guard-image-client\"", StringComparison.Ordinal))
            {
                var script = "<script id=\"media-access-guard-image-client\" src=\"" +
                    WebUtility.HtmlEncode(prefix + "/MediaSecurity/image-client.js?v=12.4-secure1") + "\"></script>";
                bytes = Encoding.UTF8.GetBytes(html.Insert(head + 1, script));
                http.Response.Headers.Remove("ETag");
                http.Response.Headers.Remove("Last-Modified");
                http.Response.Headers.Remove("Content-Encoding");
                http.Response.Headers.CacheControl = "no-store";
            }
        }

        http.Response.ContentLength = bytes.Length;
        await http.Response.Body.WriteAsync(bytes, http.RequestAborted).ConfigureAwait(false);
    }
}
