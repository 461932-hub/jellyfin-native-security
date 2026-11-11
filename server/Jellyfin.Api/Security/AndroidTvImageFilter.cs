// Native media hardening for the 12.4 test fork. GPL-2.0-or-later.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using MediaBrowser.Model.Search;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Jellyfin.Api.Security;

/// <summary>Adapt per-response image tags, without mutating native library DTOs.</summary>
internal sealed class AndroidTvImageFilter(ImageGrantProtector grants, IOptions<JsonOptions> json, IOptionsMonitor<SecureMediaOptions> secureOptions) : IAsyncResultFilter
{
    private const int GrantLimit = 8192;

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        var http = context.HttpContext;
        var user = http.User;
        var config = secureOptions.CurrentValue;
        var client = user.FindFirst("Jellyfin-Client")?.Value;
        var device = user.FindFirst("Jellyfin-DeviceId")?.Value;
        var token = user.FindFirst("Jellyfin-Token")?.Value;
        if (config?.EnableAndroidTvImageCompatibility != true
            || user.Identity?.IsAuthenticated != true
            || !Guid.TryParse(user.FindFirst("Jellyfin-UserId")?.Value, out var userId) || userId.Equals(Guid.Empty)
            || !(string.Equals(client, "Jellyfin Android TV", StringComparison.OrdinalIgnoreCase)
                || string.Equals(client, "Jellyfin for Android TV", StringComparison.OrdinalIgnoreCase))
            || user.FindFirst("Jellyfin-Version")?.Value != "0.19.10"
            || device is not { Length: > 0 and <= 128 } || token is not { Length: > 0 and <= 512 }
            || (!http.Request.IsHttps && !config.AllowInsecureHttpImages)
            || (config.AndroidTvImageDeviceIds is { Length: > 0 } ids && !ids.Contains(device, StringComparer.Ordinal))
            || context.ActionDescriptor is not ControllerActionDescriptor action
            || action.ControllerTypeInfo.Assembly.GetName().Name != "Jellyfin.Api"
            || context.Result is not ObjectResult { Value: not null } result
            || result.StatusCode is >= 300 || !Supported(result.Value))
        {
            await next();
            return;
        }

        // Serializing into a separate tree avoids modifying per-user or shared
        // native DTO dictionaries and retains Jellyfin's configured JSON shape.
        var tree = JsonSerializer.SerializeToNode(result.Value, result.Value.GetType(), json.Value.JsonSerializerOptions);
        var remaining = GrantLimit;
        IEnumerable<JsonObject> entries = tree switch
        {
            JsonArray array => array.OfType<JsonObject>(),
            JsonObject obj when result.Value is QueryResult<BaseItemDto> && Property(obj, "Items") is JsonArray items => items.OfType<JsonObject>(),
            JsonObject obj when result.Value is SearchHintResult && Property(obj, "SearchHints") is JsonArray hints => hints.OfType<JsonObject>(),
            JsonObject obj => [obj],
            _ => [],
        };

        // The list can contain thousands of cast entries. Give every movie's
        // artwork priority over related images elsewhere in the same page.
        foreach (var entry in entries)
        {
            ProtectImages(entry);
        }

        foreach (var entry in entries)
        {
            if (remaining <= 0)
            {
                break;
            }

            ProtectRelatedImages(entry);
        }

        if (remaining < GrantLimit)
        {
            result.Value = tree;
            result.DeclaredType = typeof(JsonNode);
            http.Response.Headers.CacheControl = "private, no-store";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
        }

        await next();

        void ProtectRelatedImages(JsonObject item)
        {
            if (remaining > 0 && Property(item, "CurrentProgram") is JsonObject program)
            {
                ProtectImages(program);
                ProtectRelatedImages(program);
            }

            if (remaining > 0 && Property(item, "People") is JsonArray people)
            {
                foreach (var person in people.OfType<JsonObject>())
                {
                    if (remaining <= 0)
                    {
                        break;
                    }

                    if (Key(person, "PrimaryImageTag") is { } primary)
                    {
                        Replace(person, primary, person, Id(person, "Id"), ImageType.Primary, 0);
                    }
                }
            }
        }

        void ProtectImages(JsonObject obj)
        {
            if (remaining <= 0)
            {
                return;
            }

            var id = Id(obj, "Id");
            if (id.Equals(Guid.Empty))
            {
                id = Id(obj, "ItemId");
            }

            if (!id.Equals(Guid.Empty) && Property(obj, "ImageTags") is JsonObject tags)
            {
                foreach (var entry in tags.ToArray())
                {
                    if (Enum.TryParse<ImageType>(entry.Key, true, out var type) && Enum.IsDefined(type))
                    {
                        Replace(tags, entry.Key, obj, id, type, 0);
                    }
                }
            }

            ReplaceArray(obj, "BackdropImageTags", id, ImageType.Backdrop);
            ReplaceArray(obj, "ParentBackdropImageTags", Id(obj, "ParentBackdropItemId"), ImageType.Backdrop);
            foreach (var (field, owner, type) in new (string, string, ImageType)[]
            {
                ("ParentPrimaryImageTag", "ParentPrimaryImageItemId", ImageType.Primary),
                ("ParentLogoImageTag", "ParentLogoItemId", ImageType.Logo),
                ("ParentArtImageTag", "ParentArtItemId", ImageType.Art),
                ("ParentThumbImageTag", "ParentThumbItemId", ImageType.Thumb),
                ("SeriesPrimaryImageTag", "SeriesId", ImageType.Primary),
                ("SeriesThumbImageTag", "SeriesId", ImageType.Thumb),
                ("AlbumPrimaryImageTag", "AlbumId", ImageType.Primary),
                ("ChannelPrimaryImageTag", "ChannelId", ImageType.Primary),
                ("ThumbImageTag", "ThumbImageItemId", ImageType.Thumb),
                ("BackdropImageTag", "BackdropImageItemId", ImageType.Backdrop)
            })
            {
                var key = Key(obj, field);
                if (key is not null)
                {
                    Replace(obj, key, obj, Id(obj, owner), type, 0);
                }
            }

            if (Key(obj, "PrimaryImageTag") is { } primary)
            {
                Replace(obj, primary, obj, id, ImageType.Primary, 0);
            }
        }

        void Replace(JsonObject owner, string key, JsonObject item, Guid id, ImageType type, int index)
        {
            var original = Text(owner[key]);
            var replacement = Protect(original, id, type, index);
            if (replacement is null)
            {
                return;
            }

            owner[key] = replacement;
            CopyBlurHash(item, type, original!, replacement);
        }

        void ReplaceArray(JsonObject obj, string field, Guid id, ImageType type)
        {
            if (Property(obj, field) is not JsonArray tags)
            {
                return;
            }

            for (var i = 0; i < tags.Count && i < 1000 && remaining > 0; i++)
            {
                var original = Text(tags[i]);
                var replacement = Protect(original, id, type, i);
                if (replacement is not null)
                {
                    tags[i] = replacement;
                    CopyBlurHash(obj, type, original!, replacement);
                }
            }
        }

        string? Protect(string? tag, Guid id, ImageType type, int index)
        {
            if (remaining <= 0 || id.Equals(Guid.Empty) || tag is not { Length: > 0 and <= 256 }
                || tag.StartsWith(ImageGrantProtector.Prefix, StringComparison.Ordinal))
            {
                return null;
            }

            remaining--;
            return grants.Create(userId, id, type, index, tag, token, device, config.AllowInsecureHttpImages);
        }
    }

    private static bool Supported(object value) => value is BaseItemDto
        || (value is QueryResult<BaseItemDto> query && query.Items.Count <= 1000)
        || (value is SearchHintResult hints && hints.SearchHints.Count <= 1000)
        || (value is IEnumerable<BaseItemDto> items && items.TryGetNonEnumeratedCount(out var count) && count <= 1000);

    private static string? Key(JsonObject obj, string name) => obj.FirstOrDefault(p => p.Key.Equals(name, StringComparison.OrdinalIgnoreCase)).Key;

    private static JsonNode? Property(JsonObject obj, string name) => Key(obj, name) is { } key ? obj[key] : null;

    private static string? Text(JsonNode? value) => value is JsonValue scalar && scalar.TryGetValue<string>(out var text) ? text : null;

    private static Guid Id(JsonObject obj, string name) => Guid.TryParse(Text(Property(obj, name)), out var id) ? id : Guid.Empty;

    private static void CopyBlurHash(JsonObject obj, ImageType type, string original, string replacement)
    {
        if (Property(obj, "ImageBlurHashes") is JsonObject types && Property(types, type.ToString()) is JsonObject hashes
            && hashes[original] is { } hash)
        {
            hashes[replacement] = hash.DeepClone();
        }
    }
}
