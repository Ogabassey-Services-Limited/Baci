#!/usr/bin/env bash
# Runs a TypeScript script from a stable local Baci checkout. Override
# BACI_REPO_DIR, BACI_WORKER_ENV, and NODE_ENV from cron/systemd per deployment.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "[run-web-script] Usage: run-web-script.sh <label> <script-path>" >&2
  exit 1
fi

LABEL="$1"
SCRIPT_PATH="$2"
DEFAULT_REPO_DIR="/opt/baci/app"
LEGACY_RUNNER_NAME="${LEGACY_RUNNER_NAME:-baci-deploy-2}"
# Temporary fallback for older VPS runner checkouts. Prefer BACI_REPO_DIR or
# /opt/baci/app; remove this once all cron hosts use the dedicated checkout.
LEGACY_RUNNER_REPO_DIR="${LEGACY_RUNNER_REPO_DIR:-$HOME/actions-runners/$LEGACY_RUNNER_NAME/_work/Baci/Baci}"

on_exit() {
  local status="$?"
  echo "[$LABEL] Finished at $(date -Iseconds) (exit $status)" >&2
}
trap on_exit EXIT

echo "[$LABEL] Starting at $(date -Iseconds)" >&2

if [[ "$SCRIPT_PATH" = /* || "$SCRIPT_PATH" =~ (^|/)\.\.(/|$) ]]; then
  echo "[$LABEL] Invalid script path: $SCRIPT_PATH" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[$LABEL] python3 is required to resolve script paths" >&2
  exit 1
fi

if [ -n "${BACI_REPO_DIR:-}" ]; then
  REPO_DIR="$BACI_REPO_DIR"
elif [ -d "$DEFAULT_REPO_DIR/apps/web" ]; then
  REPO_DIR="$DEFAULT_REPO_DIR"
elif [ -d "$LEGACY_RUNNER_REPO_DIR/apps/web" ]; then
  echo "[$LABEL] Using legacy runner checkout fallback. Set BACI_REPO_DIR or move the checkout to $DEFAULT_REPO_DIR." >&2
  REPO_DIR="$LEGACY_RUNNER_REPO_DIR"
else
  echo "[$LABEL] No checkout found. Set BACI_REPO_DIR or ensure $DEFAULT_REPO_DIR/apps/web exists." >&2
  exit 1
fi

ENV_FILE="${BACI_WORKER_ENV:-$HOME/baci-workers/.env}"
case "$ENV_FILE" in
  /*) ;;
  \~|\~/*) ENV_FILE="${ENV_FILE/#\~/$HOME}" ;;
  \~*)
    ENV_USER="${ENV_FILE#\~}"
    ENV_USER="${ENV_USER%%/*}"
    ENV_USER_HOME="$(getent passwd "$ENV_USER" | cut -d: -f6 || true)"
    if [ -z "$ENV_USER_HOME" ]; then
      echo "[$LABEL] Unable to resolve home directory for env file user: $ENV_USER" >&2
      exit 1
    fi
    ENV_USER_PREFIX="~$ENV_USER"
    ENV_FILE="${ENV_USER_HOME}${ENV_FILE#"$ENV_USER_PREFIX"}"
    ;;
  *) ENV_FILE="$PWD/$ENV_FILE" ;;
esac

if [ ! -d "$REPO_DIR/apps/web" ]; then
  echo "[$LABEL] Missing Baci checkout: $REPO_DIR" >&2
  exit 1
fi

WEB_DIR="$(python3 - "$REPO_DIR/apps/web" <<'PY'
from pathlib import Path
import sys

print(Path(sys.argv[1]).resolve())
PY
)"
SCRIPT_FILE="$(python3 - "$WEB_DIR" "$SCRIPT_PATH" <<'PY'
from pathlib import Path
import sys

print((Path(sys.argv[1]) / sys.argv[2]).resolve())
PY
)"

case "$SCRIPT_FILE" in
  "$WEB_DIR"/*) ;;
  *)
    echo "[$LABEL] Script path must resolve inside apps/web: $SCRIPT_PATH" >&2
    exit 1
    ;;
esac

if [ ! -f "$SCRIPT_FILE" ]; then
  echo "[$LABEL] Missing script file: $SCRIPT_FILE" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[$LABEL] Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [ -z "${NODE_ENV:-}" ]; then
  echo "[$LABEL] NODE_ENV must be set explicitly" >&2
  exit 1
fi

export NODE_ENV
export DOTENV_CONFIG_PATH="$ENV_FILE"

cd "$REPO_DIR" || {
  echo "[$LABEL] Failed to change directory to: $REPO_DIR" >&2
  exit 1
}
if ! tsx_output=$(pnpm --filter @baci/web exec tsx --version 2>&1); then
  echo "[$LABEL] tsx check output: $tsx_output" >&2
  echo "[$LABEL] Missing tsx in $REPO_DIR. Run pnpm install --frozen-lockfile for the Baci checkout; do not use a production-only install until the worker entrypoints are compiled." >&2
  exit 1
fi

pnpm --filter @baci/web exec tsx "$SCRIPT_FILE"
