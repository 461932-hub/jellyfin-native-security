#!/usr/bin/env bash
set -euo pipefail
task_image=${1:?Docker image required}
task_container=jellyfin-native-ci-smoke
task_config=jellyfin-native-ci-config
task_cache=jellyfin-native-ci-cache
task_cleanup() {
    task_exit=$?
    if [[ "$task_exit" != 0 ]]; then
        echo 'Docker smoke test failed; isolated container diagnostics:' >&2
        docker inspect --format '{{json .State}}' "$task_container" >&2 || true
        docker logs --tail 160 "$task_container" >&2 || true
    fi
    docker rm -f "$task_container" >/dev/null 2>&1 || true
    docker volume rm "$task_config" "$task_cache" >/dev/null 2>&1 || true
    return "$task_exit"
}
trap task_cleanup EXIT
docker run --detach --name "$task_container" \
    --read-only --cap-drop ALL --security-opt no-new-privileges:true \
    --tmpfs /tmp:rw,nosuid,nodev,size=256m \
    --mount "type=volume,source=$task_config,target=/config" \
    --mount "type=volume,source=$task_cache,target=/cache" \
    --publish 127.0.0.1:18099:8096 \
    --env JELLYFIN_SecureMedia__PlaybackBaseUrl=http://127.0.0.1:18099 \
    --env JELLYFIN_SecureMedia__AllowInsecureHttpPlayback=true \
    --env JELLYFIN_SecureMedia__AllowInsecureHttpImages=true \
    "$task_image" >/dev/null
task_ready=false
for task_try in $(seq 1 90); do
    if curl --silent --fail --max-time 3 http://127.0.0.1:18099/health > /tmp/native-health.txt \
        && curl --silent --fail --max-time 3 http://127.0.0.1:18099/System/Info/Public > /tmp/native-public-info.json; then
        task_ready=true
        break
    fi
    if [[ $(docker inspect --format '{{.State.Running}}' "$task_container") != true ]]; then
        docker logs "$task_container"
        exit 1
    fi
    sleep 1
done
if [[ "$task_ready" != true ]]; then docker logs "$task_container"; exit 1; fi
[[ $(docker exec "$task_container" id -u) == 1000 ]]
docker exec "$task_container" sh -c 'test -w /config && test -w /cache'
docker exec "$task_container" sh -c "grep -Eq '^CapEff:[[:space:]]+0+$' /proc/1/status"
for task_path in \
    Items/11111111111111111111111111111111/Images/Primary \
    'Videos/11111111111111111111111111111111/stream?Static=true'; do
    task_status=$(curl --silent --show-error --max-time 10 --retry 3 --retry-connrefused --retry-all-errors \
        --output /dev/null --dump-header /tmp/native-headers.txt \
        --write-out '%{http_code}' "http://127.0.0.1:18099/$task_path")
    [[ "$task_status" == 401 ]]
    grep -qi '^X-Jellyfin-Media-Security: native-preview-1' /tmp/native-headers.txt
done
mkdir -p test-results
printf '%s\n' '{"passed":true,"platform":"linux/amd64","containerUid":1000,"effectiveCapabilities":0,"namedVolumesWritable":true,"anonymousImageStatus":401,"anonymousVideoStatus":401,"scope":"Fresh Docker CI instance; no physical Fire TV test"}' > test-results/docker-smoke.json
echo 'Docker starts as UID 1000 with writable named volumes, no capabilities and anonymous media blocked.'
