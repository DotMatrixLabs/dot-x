#!/bin/sh
set -e

# Reload udev rules and trigger any already-connected USB serial devices
# so the new uaccess tag takes effect without a replug.
if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules
    udevadm trigger --subsystem-match=tty --action=add
fi
