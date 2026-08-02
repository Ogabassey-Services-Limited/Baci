#!/usr/bin/bash
set -euo pipefail

if [[ "$#" -ne 0 ]]; then
  echo 'entrypoint.sh: unexpected arguments' >&2
  exit 1
fi
exec /opt/node/bin/node /opt/baci-cwv/entrypoint.mjs --mode normal
