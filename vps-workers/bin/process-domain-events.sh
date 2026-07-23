#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export BACI_WORKER_PROFILE="${BACI_WORKER_PROFILE:-event-pipeline}"
exec "$SCRIPT_DIR/run-web-script.sh" \
  process-domain-events \
  src/scripts/process-domain-events.ts \
  "$@"
