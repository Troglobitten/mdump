#!/bin/sh
set -e

# Ensure the mounted data volume is owned by the unprivileged app user, then
# drop from root to that user before running the server. This keeps existing
# root-owned volumes working without requiring the host to re-chown them.
chown -R app:app /data 2>/dev/null || true

exec su-exec app "$@"
