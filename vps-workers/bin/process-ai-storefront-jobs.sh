#!/usr/bin/env bash
# Runs the ai-storefront-jobs worker by resolving SCRIPT_DIR and delegating to
# run-web-script.sh, which executes process-ai-storefront-jobs.ts with dotenv.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run-web-script.sh" ai-storefront-jobs src/scripts/process-ai-storefront-jobs.ts
