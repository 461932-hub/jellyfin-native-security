#!/bin/sh
# CasaOS bootstrap. GPL-2.0; only empty mount roots are initialized as root.
set -eu

task_uid=${PUID:-1000}
task_gid=${PGID:-1000}
for task_id in "$task_uid" "$task_gid"; do
    case "$task_id" in ''|*[!0-9]*) echo 'PUID and PGID must be positive numeric IDs.' >&2; exit 1;; esac
    if ! [ "$task_id" -gt 0 ] 2>/dev/null || ! [ "$task_id" -le 2147483647 ] 2>/dev/null; then
        echo 'PUID and PGID must be between 1 and 2147483647.' >&2
        exit 1
    fi
done
task_uid=$(expr "$task_uid" + 0)
task_gid=$(expr "$task_gid" + 0)

if [ "$(id -u)" = 0 ]; then
    for task_path in /config /cache; do
        if [ ! -d "$task_path" ] || [ -L "$task_path" ]; then
            echo "Expected a directory mount at $task_path; refusing startup." >&2
            exit 1
        fi
        if [ "$(stat -c '%u:%g' "$task_path")" != "$task_uid:$task_gid" ]; then
            # Do not recursively change ownership of existing settings or data.
            if ! task_contents=$(find "$task_path" -mindepth 1 -maxdepth 1 -print -quit); then
                echo "Cannot inspect $task_path; refusing automatic ownership changes." >&2
                exit 1
            fi
            if [ -n "$task_contents" ]; then
                echo "$task_path is nonempty and not owned by $task_uid:$task_gid; refusing automatic ownership changes." >&2
                exit 1
            fi
            chown --no-dereference "$task_uid:$task_gid" "$task_path"
        fi
    done
    # Preserve Docker group_add and include only groups of explicitly passed
    # render devices. No chmod/chown on devices or media and no privileged mode.
    task_groups=$task_gid
    for task_group in $(id -G); do
        if [ "$task_group" != 0 ]; then task_groups="$task_groups,$task_group"; fi
    done
    for task_device in /dev/dri/card* /dev/dri/renderD*; do
        if [ -c "$task_device" ]; then
            task_group=$(stat -c '%g' "$task_device")
            if [ "$task_group" != 0 ]; then task_groups="$task_groups,$task_group"; fi
        fi
    done
    exec setpriv --reuid "$task_uid" --regid "$task_gid" --groups "$task_groups" --no-new-privs \
        flock --nonblock --no-fork --conflict-exit-code 75 /config/.jellyfin-native.lock \
        /usr/local/bin/jellyfin-native-start "$@"
fi

if [ "$(id -u):$(id -g)" != "$task_uid:$task_gid" ]; then
    echo 'Runtime UID/GID must match the configured PUID/PGID.' >&2
    exit 1
fi
exec setpriv --no-new-privs flock --nonblock --no-fork --conflict-exit-code 75 \
    /config/.jellyfin-native.lock /usr/local/bin/jellyfin-native-start "$@"
