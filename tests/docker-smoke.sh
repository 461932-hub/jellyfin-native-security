#!/usr/bin/env bash
set -euo pipefail
task_image=${1:?Docker image required}
task_container=jellyfin-native-ci-smoke
task_config=jellyfin-native-ci-config
task_cache=jellyfin-native-ci-cache
task_bind=$(mktemp -d /tmp/jellyfin-native-bind.XXXXXXXX)
task_boot_caps=(--cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID)
task_cleanup() {
    task_exit=$?
    if [[ "$task_exit" != 0 ]]; then
        echo 'Docker smoke test failed; isolated container diagnostics:' >&2
        docker inspect --format '{{json .State}}' "$task_container" >&2 || true
        docker logs --tail 160 "$task_container" >&2 || true
    fi
    docker rm -f "$task_container" >/dev/null 2>&1 || true
    docker volume rm "$task_config" "$task_cache" >/dev/null 2>&1 || true
    if [[ "$task_bind" == /tmp/jellyfin-native-bind.* && $(realpath -- "$task_bind") == "$task_bind" ]]; then
        sudo rm -rf -- "$task_bind"
    fi
    return "$task_exit"
}
trap task_cleanup EXIT

mkdir -p "$task_bind/config" "$task_bind/cache" "$task_bind/media" \
    "$task_bind/foreign" "$task_bind/private"
printf 'original-media-marker\n' > "$task_bind/media/marker"
docker run --rm --read-only --cap-drop ALL --user "$(id -u):$(id -g)" \
    --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg \
    --mount "type=bind,source=$task_bind/media,target=/fixture" \
    "$task_image" -hide_banner -loglevel error \
    -f lavfi -i 'color=c=blue:s=320x180:r=10:d=4' \
    -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=4' \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 2 -shortest -movflags +faststart \
    '/fixture/Native Identity Fixture (2026).mp4'
sudo chown 0:0 "$task_bind/config" "$task_bind/cache" "$task_bind/foreign"
printf 'foreign-data-marker\n' | sudo tee "$task_bind/foreign/keep" >/dev/null
sudo chown 2000:2000 "$task_bind/private"
sudo chmod 700 "$task_bind/private"

# Refuse existing foreign data without changing its owner or contents.
if docker run --rm --read-only "${task_boot_caps[@]}" --security-opt no-new-privileges:true \
    --mount "type=bind,source=$task_bind/foreign,target=/config" \
    --mount "type=bind,source=$task_bind/cache,target=/cache" \
    "$task_image" true > "$task_bind/foreign-check.log" 2>&1; then
    echo 'Expected foreign nonempty configuration to be refused.' >&2
    exit 1
fi
grep -q 'nonempty and not owned' "$task_bind/foreign-check.log"
[[ $(stat -c '%u:%g' "$task_bind/foreign") == 0:0 ]]
[[ $(cat "$task_bind/foreign/keep") == foreign-data-marker ]]

# A failed directory listing must never be mistaken for an empty directory.
if docker run --rm --read-only "${task_boot_caps[@]}" --security-opt no-new-privileges:true \
    --mount "type=bind,source=$task_bind/private,target=/config" \
    --mount "type=bind,source=$task_bind/cache,target=/cache" \
    "$task_image" true > "$task_bind/private-check.log" 2>&1; then
    echo 'Expected unreadable foreign directory to be refused.' >&2
    exit 1
fi
grep -q 'Cannot inspect /config' "$task_bind/private-check.log"
[[ $(stat -c '%u:%g' "$task_bind/private") == 2000:2000 ]]

# Existing direct-Docker installations can still override USER to 1000.
docker run --rm --read-only --user 1000:1000 --cap-drop ALL \
    --mount "type=volume,source=$task_config,target=/config" \
    --mount "type=volume,source=$task_cache,target=/cache" \
    "$task_image" sh -c 'test "$(id -u):$(id -g)" = 1000:1000 && test -w /config && test -w /cache && grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/1/status'

# Reproduce CasaOS: new, root-owned bind directories and a short root bootstrap.
docker run --detach --name "$task_container" \
    --read-only "${task_boot_caps[@]}" --security-opt no-new-privileges:true \
    --tmpfs /tmp:rw,nosuid,nodev,size=256m \
    --mount "type=bind,source=$task_bind/config,target=/config" \
    --mount "type=bind,source=$task_bind/cache,target=/cache" \
    --mount "type=bind,source=$task_bind/media,target=/Media,readonly" \
    --mount "type=bind,source=$task_bind/media,target=/HDD,readonly" \
    --publish 127.0.0.1:18099:8096 \
    --env JELLYFIN_SecureMedia__PlaybackBaseUrl=http://127.0.0.1:18099 \
    --env JELLYFIN_SecureMedia__AllowInsecureHttpPlayback=true \
    --env JELLYFIN_SecureMedia__AllowInsecureHttpImages=true \
    "$task_image" >/dev/null

task_wait_ready() {
    for task_try in $(seq 1 90); do
        if curl --silent --fail --max-time 3 http://127.0.0.1:18099/health > /tmp/native-health.txt \
            && curl --silent --fail --max-time 3 --dump-header /tmp/native-ready-headers.txt \
                http://127.0.0.1:18099/System/Info/Public > /tmp/native-public-info.json \
            && grep -qi '^X-Jellyfin-Media-Security: native-preview-1' /tmp/native-ready-headers.txt; then
            return 0
        fi
        [[ $(docker inspect --format '{{.State.Running}}' "$task_container") == true ]] || return 1
        sleep 1
    done
    return 1
}
task_wait_ready
curl --silent --fail --max-time 10 http://127.0.0.1:18099/web/index.html > /tmp/native-cinema-index.html
grep -q 'cinema-boot.js?v=8' /tmp/native-cinema-index.html
grep -q 'cinema-native.css?v=8' /tmp/native-cinema-index.html
grep -q 'cinema-native.js?v=8' /tmp/native-cinema-index.html
curl --silent --fail --max-time 10 http://127.0.0.1:18099/web/cinema-boot.js > /tmp/native-cinema-boot.js
cmp web/cinema-boot.js /tmp/native-cinema-boot.js
curl --silent --fail --max-time 10 http://127.0.0.1:18099/web/cinema-native.js > /tmp/native-cinema-served.js
curl --silent --fail --max-time 10 http://127.0.0.1:18099/web/cinema-native.css > /tmp/native-cinema-served.css
cmp web/cinema-native.js /tmp/native-cinema-served.js
cmp web/cinema-native.css /tmp/native-cinema-served.css
curl --silent --fail --max-time 10 http://127.0.0.1:18099/web/cinema-logo.png > /tmp/native-cinema-logo.png
cmp web/cinema-logo.png /tmp/native-cinema-logo.png
[[ $(docker exec --user 1000:1000 "$task_container" id -u) == 1000 ]]
[[ $(stat -c '%u:%g' "$task_bind/config") == 1000:1000 ]]
[[ $(stat -c '%u:%g' "$task_bind/cache") == 1000:1000 ]]
docker exec --user 1000:1000 "$task_container" sh -c 'test -w /config && test -w /cache'
docker exec --user 1000:1000 "$task_container" sh -c "grep -Eq '^Uid:[[:space:]]+1000[[:space:]]' /proc/1/status"
docker exec --user 1000:1000 "$task_container" sh -c "grep -Eq '^CapEff:[[:space:]]+0+$' /proc/1/status"
docker exec --user 1000:1000 "$task_container" sh -c "grep -Eq '^NoNewPrivs:[[:space:]]+1$' /proc/1/status"
if docker exec --user 1000:1000 "$task_container" touch /Media/forbidden-write > /dev/null 2>&1; then
    echo 'Media bind was writable unexpectedly.' >&2
    exit 1
fi
[[ $(cat "$task_bind/media/marker") == original-media-marker ]]

for task_path in \
    Items/11111111111111111111111111111111/Images/Primary \
    'Videos/11111111111111111111111111111111/stream?Static=true'; do
    task_status=$(curl --silent --show-error --max-time 10 --retry 3 --retry-connrefused --retry-all-errors \
        --output /dev/null --dump-header /tmp/native-headers.txt \
        --write-out '%{http_code}' "http://127.0.0.1:18099/$task_path")
    [[ "$task_status" == 401 ]]
    grep -qi '^X-Jellyfin-Media-Security: native-preview-1' /tmp/native-headers.txt
done

python3 tests/tv-device-identity.py

# A restart with the now nonempty, correctly owned directories must also work.
docker restart "$task_container" >/dev/null
task_wait_ready
[[ $(docker exec --user 1000:1000 "$task_container" id -u) == 1000 ]]
docker exec --user 1000:1000 "$task_container" sh -c "grep -Eq '^CapEff:[[:space:]]+0+$' /proc/1/status"
mkdir -p test-results
printf '%s\n' '{"passed":true,"platform":"linux/amd64","containerUid":1000,"effectiveCapabilities":0,"noNewPrivileges":true,"rootOwnedBindDirectoriesInitialized":true,"correctlyOwnedNonemptyDirectoriesRestart":true,"foreignNonemptyDirectoryRefused":true,"unreadableForeignDirectoryRefused":true,"namedVolumeNonrootRegression":true,"mediaReadOnly":true,"anonymousImageStatus":401,"anonymousVideoStatus":401,"scope":"Fresh Docker CI instance with CasaOS bind layout; no physical Fire TV or live CasaOS UI test"}' > test-results/docker-smoke.json
echo 'CasaOS bind layout works, bootstrap drops privileges, restart and refusal cases pass, media remains protected.'
