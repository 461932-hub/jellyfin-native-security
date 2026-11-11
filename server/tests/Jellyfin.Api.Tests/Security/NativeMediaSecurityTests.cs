using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Jellyfin.Api.Controllers;
using Jellyfin.Api.Security;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using Xunit;

namespace Jellyfin.Api.Tests.Security;

public sealed class NativeMediaSecurityTests
{
    private const string NativeToken = "unit-test-native-session";
    private const string Source = "source-one";
    private const string Session = "play-session-one";
    private const string Device = "fire-tv-one";
    private static readonly Guid UserId = Guid.Parse("11111111111111111111111111111111");
    private static readonly Guid ItemId = Guid.Parse("22222222222222222222222222222222");

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ImageFilter_ProtectsEveryMovieCoverOnAFullPage(bool wrapped)
    {
        // The TV grid asks for 100 movies at a time. A large cast in each entry
        // must not consume the image grants needed for later movie covers.
        var cast = Enumerable.Range(0, 90).Select(index => new BaseItemPerson
        {
            Id = Guid.NewGuid(),
            Name = "Actor " + index,
            Role = "Character " + index,
            PrimaryImageTag = "cast-poster",
        }).ToArray();
        var movies = Enumerable.Range(0, 100).Select(index => new BaseItemDto
        {
            Id = Guid.NewGuid(),
            Name = "Movie " + index,
            People = cast,
            ImageTags = new Dictionary<ImageType, string>
            {
                [ImageType.Primary] = "movie-poster",
                [ImageType.Thumb] = "movie-thumb",
            },
            BackdropImageTags = ["movie-backdrop"],
        }).ToArray();
        var result = new OkObjectResult(wrapped ? new QueryResult<BaseItemDto>(100, 300, movies) : movies);
        Claim[] claims =
        [
            new Claim("Jellyfin-Client", "Jellyfin Android TV"),
            new Claim("Jellyfin-Version", "0.19.10"),
            new Claim("Jellyfin-DeviceId", Device),
            new Claim("Jellyfin-Token", NativeToken),
            new Claim("Jellyfin-UserId", UserId.ToString("N")),
        ];
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
        };
        http.Request.Scheme = "http";
        ActionDescriptor descriptor = new ControllerActionDescriptor { ControllerTypeInfo = typeof(ItemsController).GetTypeInfo() };
        var action = new ActionContext(http, new RouteData(), descriptor);
        var controller = new object();
        var context = new ResultExecutingContext(action, [], result, controller);
        var json = new JsonOptions();
        json.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        json.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        var grants = new ImageGrantProtector(new Clock());
        var filter = new AndroidTvImageFilter(grants, Options.Create(json), new Monitor(new SecureMediaOptions { AllowInsecureHttpImages = true }));
        await filter.OnResultExecutionAsync(context, () => Task.FromResult(new ResultExecutedContext(action, [], result, controller)));

        var tree = Assert.IsAssignableFrom<JsonNode>(result.Value);
        var entries = Assert.IsType<JsonArray>(wrapped ? tree["items"] : tree);
        Assert.Equal(100, entries.Count);
        if (wrapped)
        {
            Assert.Equal(100, tree["startIndex"]!.GetValue<int>());
            Assert.Equal(300, tree["totalRecordCount"]!.GetValue<int>());
        }

        for (var index = 0; index < movies.Length; index++)
        {
            var entry = entries[index]!;
            var id = movies[index].Id;
            AssertGrant(entry["imageTags"]![nameof(ImageType.Primary)], id, ImageType.Primary);
            AssertGrant(entry["imageTags"]![nameof(ImageType.Thumb)], id, ImageType.Thumb);
            AssertGrant(entry["backdropImageTags"]![0], id, ImageType.Backdrop);
            Assert.Equal("movie-poster", movies[index].ImageTags[ImageType.Primary]);
        }

        AssertGrant(entries[0]!["people"]![0]!["primaryImageTag"], cast[0].Id, ImageType.Primary);
        Assert.Equal("cast-poster", cast[0].PrimaryImageTag);
        Assert.Equal("private, no-store", http.Response.Headers.CacheControl.ToString());

        void AssertGrant(JsonNode? value, Guid id, ImageType type)
        {
            Assert.NotNull(value);
            Assert.True(grants.TryRead(value.GetValue<string>(), out var grant));
            Assert.NotNull(grant);
            Assert.Equal(id, grant.ItemId);
            Assert.Equal(type, grant.Type);
            Assert.Equal(UserId, grant.UserId);
        }
    }

    [Fact]
    public void Capability_IsOpaqueAndContainsNoNativeToken()
    {
        var store = new SecurePlaybackGrantStore(new Clock());
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        Assert.NotNull(handle);
        Assert.Equal(48, handle.Length);
        Assert.DoesNotContain(NativeToken, handle, StringComparison.Ordinal);
        Assert.True(store.TryRead(handle, out var grant));
        Assert.NotNull(grant);
        Assert.Equal(UserId, grant.UserId);
        Assert.Equal(ItemId, grant.ItemId);
        Assert.DoesNotContain(NativeToken, grant.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Capability_ExpiresWithoutAuthenticatedProgress()
    {
        var clock = new Clock();
        var store = new SecurePlaybackGrantStore(clock);
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        clock.Advance(TimeSpan.FromMinutes(9));
        Assert.True(store.TryRead(handle, out _));
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.False(store.TryRead(handle, out _));
    }

    [Fact]
    public void Capability_RenewsOnlyThroughBoundPlaybackProgress()
    {
        var clock = new Clock();
        var store = new SecurePlaybackGrantStore(clock);
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        clock.Advance(TimeSpan.FromMinutes(9));
        store.Report(UserId, ItemId, Source, Session, Device, NativeToken, false);
        clock.Advance(TimeSpan.FromMinutes(9));
        Assert.True(store.TryRead(handle, out _));
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.False(store.TryRead(handle, out _));
    }

    [Theory]
    [InlineData("user")]
    [InlineData("item")]
    [InlineData("source")]
    [InlineData("session")]
    [InlineData("device")]
    [InlineData("token")]
    public void Capability_ForeignProgressCannotRenew(string changed)
    {
        var clock = new Clock();
        var store = new SecurePlaybackGrantStore(clock);
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        clock.Advance(TimeSpan.FromMinutes(9));
        store.Report(
            changed == "user" ? Guid.NewGuid() : UserId,
            changed == "item" ? Guid.NewGuid() : ItemId,
            changed == "source" ? "other-source" : Source,
            changed == "session" ? "other-session" : Session,
            changed == "device" ? "other-device" : Device,
            changed == "token" ? "other-token" : NativeToken,
            false);
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.False(store.TryRead(handle, out _));
    }

    [Fact]
    public void Capability_PlaybackStopRevokesImmediately()
    {
        var store = new SecurePlaybackGrantStore(new Clock());
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        store.Report(UserId, ItemId, Source, Session, Device, NativeToken, true);
        Assert.False(store.TryRead(handle, out _));
    }

    [Fact]
    public void Capability_CannotOutliveItsAbsoluteMaximum()
    {
        var clock = new Clock();
        var store = new SecurePlaybackGrantStore(clock);
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        for (var minute = 1; minute < 480; minute++)
        {
            clock.Advance(TimeSpan.FromMinutes(1));
            store.Report(UserId, ItemId, Source, Session, Device, NativeToken, false);
        }

        Assert.True(store.TryRead(handle, out _));
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.False(store.TryRead(handle, out _));
    }

    [Fact]
    public void Capability_OneUserCannotExhaustAnotherUsersQuota()
    {
        var clock = new Clock();
        var store = new SecurePlaybackGrantStore(clock);
        for (var i = 0; i < 32; i++)
        {
            Assert.NotNull(store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false));
        }

        Assert.Null(store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false));
        Assert.NotNull(store.Create(Guid.NewGuid(), ItemId, Source, Session, Device, NativeToken, false));
        clock.Advance(TimeSpan.FromMinutes(10));
        Assert.NotNull(store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false));
    }

    [Theory]
    [InlineData("https://movies.example/media", false, true)]
    [InlineData("http://192.168.0.113:8099/media", false, false)]
    [InlineData("http://jellyfin:8096/media", false, false)]
    [InlineData("http://jellyfin:8096/media", true, true)]
    [InlineData("https://user:password@movies.example/media", false, false)]
    [InlineData("https://movies.example/media?ApiKey=value", false, false)]
    [InlineData("https://movies.example/media#fragment", false, false)]
    public void PlaybackBase_RequiresExplicitTrustedConfiguration(string address, bool allowHttp, bool expected)
    {
        var options = new SecureMediaOptions { PlaybackBaseUrl = address, AllowInsecureHttpPlayback = allowHttp };
        Assert.Equal(expected, options.TryGetPlaybackBase(out var parsed));
        if (expected)
        {
            Assert.NotNull(parsed);
            Assert.Equal(new Uri(address).Scheme, parsed.Scheme);
            Assert.Equal(new Uri(address).Port, parsed.Port);
        }
    }

    [Fact]
    public async Task Middleware_RecoversNativeAuthenticationOnlyForExactOriginalFile()
    {
        var store = new SecurePlaybackGrantStore(new Clock());
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        var http = Request(handle);
        var called = false;
        var middleware = new SecurePlaybackGrantMiddleware(
            context =>
            {
                called = true;
                Assert.Equal("MediaBrowser Token=\"" + NativeToken + "\", DeviceId=\"" + Device + "\"", context.Request.Headers.Authorization);
                return Task.CompletedTask;
            },
            store,
            new Monitor(new SecureMediaOptions { PlaybackBaseUrl = "https://movies.example/media" }));
        await middleware.InvokeAsync(http);
        Assert.True(called);
        Assert.True(http.Items.ContainsKey(SecurePlaybackGrantMiddleware.GrantAuthentication));
    }

    [Theory]
    [InlineData("different-item")]
    [InlineData("different-source")]
    [InlineData("different-session")]
    [InlineData("api-route")]
    [InlineData("post")]
    [InlineData("http")]
    [InlineData("transcoding")]
    [InlineData("unknown-query")]
    [InlineData("explicit-credentials")]
    [InlineData("tampered")]
    public async Task Middleware_RejectsMisuseWithoutInvokingDownstream(string changed)
    {
        var store = new SecurePlaybackGrantStore(new Clock());
        var handle = store.Create(UserId, ItemId, Source, Session, Device, NativeToken, false);
        var http = Request(handle);
        switch (changed)
        {
            case "different-item": http.Request.Path = "/Videos/" + Guid.NewGuid().ToString("N") + "/stream"; break;
            case "different-source": http.Request.QueryString = new QueryString(http.Request.QueryString.Value!.Replace(Source, "other-source", StringComparison.Ordinal)); break;
            case "different-session": http.Request.QueryString = new QueryString(http.Request.QueryString.Value!.Replace(Session, "other-session", StringComparison.Ordinal)); break;
            case "api-route": http.Request.Path = "/System/Configuration"; break;
            case "post": http.Request.Method = "POST"; break;
            case "http": http.Request.Scheme = "http"; break;
            case "transcoding": http.Request.QueryString = new QueryString(http.Request.QueryString.Value!.Replace("Static=true", "Static=false", StringComparison.Ordinal)); break;
            case "unknown-query": http.Request.QueryString = http.Request.QueryString.Add("Params", "other-file"); break;
            case "explicit-credentials": http.Request.Headers.Authorization = "MediaBrowser Token=\"other-token\""; break;
            case "tampered": http.Request.QueryString = new QueryString(http.Request.QueryString.Value!.Replace(handle!, handle![..^1] + (handle[^1] == 'A' ? "B" : "A"), StringComparison.Ordinal)); break;
        }

        var called = false;
        var middleware = new SecurePlaybackGrantMiddleware(
            _ =>
            {
                called = true;
                return Task.CompletedTask;
            },
            store,
            new Monitor(new SecureMediaOptions { PlaybackBaseUrl = "https://movies.example/media" }));
        await middleware.InvokeAsync(http);
        Assert.False(called);
        Assert.Equal(401, http.Response.StatusCode);
        Assert.False(http.Request.Headers.ContainsKey("Authorization") && changed != "explicit-credentials");
    }

    private static DefaultHttpContext Request(string? handle)
    {
        var http = new DefaultHttpContext();
        http.Request.Scheme = "https";
        http.Request.Method = "GET";
        http.Request.PathBase = "/media";
        http.Request.Path = "/Videos/" + ItemId.ToString("N") + "/stream";
        http.Request.QueryString = QueryString.Create(new Dictionary<string, string?>
        {
            ["PlaybackGrant"] = handle,
            ["Static"] = "true",
            ["MediaSourceId"] = Source,
            ["PlaySessionId"] = Session,
        });
        return http;
    }

    private sealed class Clock : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 11, 2, 0, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => _now;

        internal void Advance(TimeSpan amount) => _now = _now.Add(amount);
    }

    private sealed class Monitor(SecureMediaOptions value) : IOptionsMonitor<SecureMediaOptions>
    {
        public SecureMediaOptions CurrentValue => value;

        public SecureMediaOptions Get(string? name) => value;

        public IDisposable? OnChange(Action<SecureMediaOptions, string?> listener) => null;
    }
}
