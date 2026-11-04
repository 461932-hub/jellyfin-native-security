#!/bin/sh
# Optional administrator-provided hooks run with Jellyfin's unprivileged ID.
# GPL-2.0-or-later.
set -eu
if [ -d /custom-cont-init.d ]; then
    for task_hook in /custom-cont-init.d/*.sh; do
        [ -f "$task_hook" ] || continue
        if [ ! -r "$task_hook" ]; then
            echo "Cannot read initialization hook: $task_hook" >&2
            exit 1
        fi
        echo "Running user initialization hook: ${task_hook##*/}"
        /bin/sh "$task_hook"
    done
fi
exec "$@"
