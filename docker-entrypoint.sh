#!/bin/sh
# CasaOS bootstrap added 2026-11-03. GPL-2.0; main server remains UID/GID 1000.
set -eu

if [ "$(id -u)" = 0 ]; then
    for task_path in /config /cache; do
        if [ ! -d "$task_path" ] || [ -L "$task_path" ]; then
            echo "Expected a directory mount at $task_path; refusing startup." >&2
            exit 1
        fi
        if [ "$(stat -c '%u:%g' "$task_path")" != '1000:1000' ]; then
            # Do not recursively change ownership of existing settings or data.
            if ! task_contents=$(find "$task_path" -mindepth 1 -maxdepth 1 -print -quit); then
                echo "Cannot inspect $task_path; refusing automatic ownership changes." >&2
                exit 1
            fi
            if [ -n "$task_contents" ]; then
                echo "$task_path is nonempty and not owned by 1000:1000; refusing automatic ownership changes." >&2
                exit 1
            fi
            chown --no-dereference 1000:1000 "$task_path"
        fi
    done
    exec setpriv --no-new-privs gosu 1000:1000 "$@"
fi

if [ "$(id -u):$(id -g)" != '1000:1000' ]; then
    echo 'This test image expects runtime UID/GID 1000:1000.' >&2
    exit 1
fi
exec setpriv --no-new-privs "$@"
