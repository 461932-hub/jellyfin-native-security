"""Exercise native authentication when Android TV changes DeviceId after login.

Only the fresh loopback Docker fixture on port 18099 is accepted. All users,
passwords, tokens and media are synthetic; no credentials or grant URLs are logged.
"""
import http.client
import json
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlencode, urlsplit

ORIGIN = 'http://127.0.0.1:18099'
LOGIN_DEVICE = 'ci-tv-before-user-session'
USER_DEVICE = 'ci-tv-after-user-session'
PASSWORD = 'NativeIdentity-' + secrets.token_urlsafe(24)
MEDIA_PATH = os.environ.get('NATIVE_IDENTITY_FIXTURE_MEDIA', '/Media')
CHECKS = []


def request(path, method='GET', data=None, token=None, device=LOGIN_DEVICE, expected=None, full_url=None):
    if full_url is not None:
        url = urlsplit(full_url)
        assert url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port == 18099
        path = url.path + '?' + url.query
    headers = {}
    if token or path == '/Users/AuthenticateByName':
        headers['Authorization'] = (
            'MediaBrowser Client="Jellyfin Android TV", Device="Synthetic CI TV", '
            f'DeviceId="{device}", Version="0.19.10"'
            + (', Token="' + token + '"' if token else ''))
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if full_url is not None:
        headers['Range'] = 'bytes=0-63'
    connection = http.client.HTTPConnection('127.0.0.1', 18099, timeout=15)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        content = response.read(2000000)
        status = response.status
    finally:
        connection.close()
    if expected is not None:
        assert status == expected, f'Unexpected HTTP status {status}; expected {expected}'
    return status, content


def api(*args, **kwargs):
    status, body = request(*args, **kwargs)
    return json.loads(body) if body else None


def passed(name):
    CHECKS.append({'name': name, 'passed': True})
    print('PASS ' + name, flush=True)


token = None
try:
    request('/Startup/User', expected=200)
    request('/Startup/User', 'POST', {'Name': 'Native Identity CI', 'Password': PASSWORD}, expected=204)
    request('/Startup/Complete', 'POST', expected=204)
    login = api('/Users/AuthenticateByName', 'POST', {'Username': 'Native Identity CI', 'Pw': PASSWORD}, expected=200)
    token = login['AccessToken']
    user_id = login['User']['Id']
    config = api('/System/Configuration', token=token, expected=200)
    assert not config['EnableLegacyAuthorization']
    request('/Library/VirtualFolders?' + urlencode({
        'name': 'NativeIdentity', 'collectionType': 'movies', 'refreshLibrary': 'true'}), 'POST',
        {'LibraryOptions': {'PathInfos': [{'Path': MEDIA_PATH}],
                            'EnableInternetProviders': False, 'EnableRealtimeMonitor': False,
                            'TypeOptions': [{'Type': 'Movie', 'MetadataFetchers': [], 'ImageFetchers': []}]}},
        token=token, expected=204)
    request('/Library/Refresh', 'POST', token=token, expected=204)
    item = None
    for attempt in range(80):
        items = api('/Items?' + urlencode({
            'recursive': 'true', 'includeItemTypes': 'Movie', 'searchTerm': 'Native Identity',
            'fields': 'MediaSources'}), token=token, expected=200)['Items']
        if items and items[0].get('MediaSources'):
            item = items[0]
            break
        time.sleep(.5)
    assert item is not None, 'Synthetic media did not appear in the fixture library'
    item_id = item['Id']
    payload = {
        'UserId': user_id, 'AudioStreamIndex': 1, 'SubtitleStreamIndex': -1,
        'EnableDirectPlay': True, 'EnableDirectStream': True, 'AutoOpenLiveStream': False,
        'MaxStreamingBitrate': 100000000,
        'DeviceProfile': {'Name': 'Synthetic H264 AAC', 'MaxStreamingBitrate': 100000000,
                          'MaxStaticBitrate': 100000000,
                          'DirectPlayProfiles': [{'Container': 'mp4,m4v', 'Type': 'Video',
                                                  'VideoCodec': 'h264', 'AudioCodec': 'aac'}],
                          'TranscodingProfiles': [], 'CodecProfiles': [], 'SubtitleProfiles': []}}

    def negotiate(device):
        info = api('/Items/' + item_id + '/PlaybackInfo', 'POST', payload,
                   token=token, device=device, expected=200)
        source = info['MediaSources'][0]
        assert source['SupportsDirectPlay'] and source['IsRemote']
        url = source['Path']
        assert 'PlaybackGrant=' in url and token not in url and 'apikey=' not in url.lower()
        return info, source, url

    _, _, original_url = negotiate(LOGIN_DEVICE)
    status, data = request('', full_url=original_url, expected=206)
    assert len(data) == 64
    passed('Direct Play with unchanged login DeviceId returns original bytes')

    info, source, user_url = negotiate(USER_DEVICE)
    status, data = request('', full_url=user_url, expected=206)
    assert len(data) == 64
    passed('Direct Play preserves user-specific DeviceId although login token stores the original DeviceId')
    request('', full_url=user_url.replace('Static=true', 'Static=false'), expected=401)
    request('', full_url=user_url.replace(source['Id'], 'different-source'), expected=401)
    passed('Changed-device grant still refuses conversion and a foreign source')

    report = {'ItemId': item_id, 'MediaSourceId': source['Id'], 'PlaySessionId': info['PlaySessionId'],
              'PositionTicks': 10000000, 'PlayMethod': 'DirectPlay', 'CanSeek': True}
    request('/Sessions/Playing', 'POST', report, token=token, device=USER_DEVICE, expected=204)
    request('/Sessions/Playing/Progress', 'POST', report, token=token, device=USER_DEVICE, expected=204)
    request('/Sessions/Playing/Stopped', 'POST', report, token=token, device=USER_DEVICE, expected=204)
    request('', full_url=user_url, expected=401)
    passed('Playback stop with user-specific DeviceId revokes its grant')

    restricted = api('/Users/New', 'POST', {'Name': 'Restricted Identity CI'}, token=token, expected=200)
    restricted_id = restricted['Id']
    request('/Users/' + restricted_id + '/Password', 'POST',
            {'CurrentPw': '', 'NewPw': PASSWORD}, token=token, expected=204)
    policy = restricted['Policy']
    policy.update({'EnableAllFolders': False, 'EnabledFolders': []})
    request('/Users/' + restricted_id + '/Policy', 'POST', policy, token=token, expected=204)
    limited = api('/Users/AuthenticateByName', 'POST',
                  {'Username': 'Restricted Identity CI', 'Pw': PASSWORD},
                  device='ci-restricted-login', expected=200)['AccessToken']
    try:
        restricted_payload = dict(payload, UserId=restricted_id)
        request('/Items/' + item_id + '/PlaybackInfo', 'POST', restricted_payload,
                token=limited, device='ci-restricted-user', expected=403)
        request('/Videos/' + item_id + '/stream?Static=true', token=limited,
                device='ci-restricted-user', expected=403)
        passed('A different DeviceId cannot bypass current library rights')
    finally:
        request('/Sessions/Logout', 'POST', token=limited, device='ci-restricted-login', expected=204)

    _, _, final_url = negotiate(USER_DEVICE)
    request('/Sessions/Logout', 'POST', token=token, expected=204)
    token = None
    request('', full_url=final_url, expected=401)
    passed('Native logout still revokes a grant bound to the user-specific DeviceId')
    request('/Videos/' + item_id + '/stream?Static=true', expected=401)
    passed('Anonymous original-file access remains blocked')
    Path('test-results').mkdir(exist_ok=True)
    Path('test-results/tv-device-identity.json').write_text(json.dumps({
        'passed': True, 'checks': CHECKS, 'noSessionTokenInPlaybackUrl': True,
        'scope': 'Synthetic media and users in isolated Docker fixture, not a physical Fire TV test'
    }, indent=2) + '\n', encoding='utf-8')
finally:
    if token:
        request('/Sessions/Logout', 'POST', token=token)
