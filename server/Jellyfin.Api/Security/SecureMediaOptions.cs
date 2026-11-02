using System;
using System.Linq;

namespace Jellyfin.Api.Security;

internal sealed class SecureMediaOptions
{
    public bool EnableAndroidTvDirectPlay { get; set; } = true;

    public string PlaybackBaseUrl { get; set; } = string.Empty;

    public bool AllowInsecureHttpPlayback { get; set; }

    public string[] AndroidTvDeviceIds { get; set; } = Array.Empty<string>();

    public bool EnableAndroidTvImageCompatibility { get; set; } = true;

    public bool AllowInsecureHttpImages { get; set; }

    public string[] AndroidTvImageDeviceIds { get; set; } = Array.Empty<string>();

    public bool TryGetPlaybackBase(out Uri? value)
    {
        value = null;
        if (PlaybackBaseUrl.Length is 0 or > 2048
            || !Uri.TryCreate(PlaybackBaseUrl, UriKind.Absolute, out var parsed)
            || parsed.UserInfo.Length != 0 || parsed.Query.Length != 0 || parsed.Fragment.Length != 0
            || (parsed.Scheme != Uri.UriSchemeHttps
                && !(parsed.Scheme == Uri.UriSchemeHttp && AllowInsecureHttpPlayback))
            || parsed.AbsolutePath.Split('/').Any(segment => segment is "." or ".."))
        {
            return false;
        }

        value = parsed;
        return true;
    }
}
