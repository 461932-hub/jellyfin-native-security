using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Api.Security;

/// <summary>Registers the native, mandatory media authentication of this fork.</summary>
public static class NativeMediaSecurityExtensions
{
    /// <summary>Registers image/media authorization and bounded TV capabilities.</summary>
    /// <param name="services">Application services.</param>
    /// <param name="configuration">Trusted server configuration.</param>
    /// <param name="serverId">Identifier for the image-only cookie namespace.</param>
    /// <returns>The service collection.</returns>
    public static IServiceCollection AddNativeMediaSecurity(
        this IServiceCollection services,
        IConfiguration configuration,
        string serverId)
    {
        services.Configure<SecureMediaOptions>(configuration.GetSection("SecureMedia"));
        services.AddSingleton<TimeProvider>(TimeProvider.System);
        services.AddSingleton<SecurePlaybackGrantStore>();
        services.AddSingleton(provider => new ImageGrantProtector(provider.GetRequiredService<TimeProvider>()));
        services.AddSingleton(provider => new ImageSessionCookie(serverId, provider.GetRequiredService<TimeProvider>()));
        services.AddScoped<MediaAuthorizationFilter>();
        services.AddScoped<ImageAuthorizationFilter>();
        services.AddScoped<SecurePlaybackGrantBindingFilter>();
        services.AddScoped<SecureAndroidTvDirectPlayFilter>();
        services.AddScoped<AndroidTvImageFilter>();
        services.AddTransient<IStartupFilter, ImageAuthenticationStartupFilter>();
        services.AddTransient<IStartupFilter, NativeSecurityHeadersStartupFilter>();
        services.Insert(0, ServiceDescriptor.Transient<IStartupFilter, ImageWebStartupFilter>());
        services.Configure<MvcOptions>(options =>
        {
            options.Filters.AddService<SecurePlaybackGrantBindingFilter>(int.MinValue);
            options.Filters.AddService<MediaAuthorizationFilter>(int.MinValue);
            options.Filters.AddService<ImageAuthorizationFilter>(int.MinValue);
            options.Filters.AddService<SecureAndroidTvDirectPlayFilter>();
            options.Filters.AddService<AndroidTvImageFilter>();
        });
        return services;
    }

    /// <summary>Resolves limited playback capabilities before native authentication.</summary>
    /// <param name="app">The application pipeline inside its configured base path.</param>
    /// <returns>The application builder.</returns>
    public static IApplicationBuilder UseNativeMediaCapabilities(this IApplicationBuilder app)
        => app.UseMiddleware<SecurePlaybackGrantMiddleware>();
}
