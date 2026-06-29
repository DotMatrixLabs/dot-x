#!/bin/sh
set -e

rm -f /etc/udev/rules.d/99-dot-x.rules

if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules
    udevadm trigger --subsystem-match=tty --action=add
fi
