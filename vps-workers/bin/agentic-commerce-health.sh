#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=react-server"
exec "$SCRIPT_DIR/run-web-script.sh" agentic-commerce-health src/scripts/agentic-commerce-health.ts
