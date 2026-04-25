#!/usr/bin/env bash
# Runs the import queue from a stable local Baci checkout. Override
# BACI_REPO_DIR, BACI_WORKER_ENV, and NODE_ENV from cron/systemd per deployment.
set -euo pipefail

DEFAULT_REPO_DIR="/opt/baci/app"
LEGACY_RUNNER_REPO_DIR="$HOME/actions-runners/baci-deploy-2/_work/Baci/Baci"

if [ -n "${BACI_REPO_DIR:-}" ]; then
  REPO_DIR="$BACI_REPO_DIR"
elif [ -d "$DEFAULT_REPO_DIR/apps/web" ]; then
  REPO_DIR="$DEFAULT_REPO_DIR"
elif [ -d "$LEGACY_RUNNER_REPO_DIR/apps/web" ]; then
  echo "[process-import-jobs] Using legacy runner checkout fallback. Set BACI_REPO_DIR or move the checkout to $DEFAULT_REPO_DIR." >&2
  REPO_DIR="$LEGACY_RUNNER_REPO_DIR"
else
  REPO_DIR="$DEFAULT_REPO_DIR"
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
      echo "[process-import-jobs] Unable to resolve home directory for env file user: $ENV_USER" >&2
      exit 1
    fi
    ENV_USER_PREFIX="~$ENV_USER"
    ENV_FILE="${ENV_USER_HOME}${ENV_FILE#"$ENV_USER_PREFIX"}"
    ;;
  *) ENV_FILE="$PWD/$ENV_FILE" ;;
esac

if [ ! -d "$REPO_DIR/apps/web" ]; then
  echo "[process-import-jobs] Missing Baci checkout: $REPO_DIR" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[process-import-jobs] Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [ -z "${NODE_ENV:-}" ]; then
  echo "[process-import-jobs] NODE_ENV must be set explicitly" >&2
  exit 1
fi

export NODE_ENV
export DOTENV_CONFIG_PATH="$ENV_FILE"

cd "$REPO_DIR" || exit 1
if ! pnpm --filter @baci/web exec tsx --version >/dev/null 2>&1; then
  echo "[process-import-jobs] Missing tsx in $REPO_DIR. Run pnpm install --frozen-lockfile for the Baci checkout; do not use a production-only install until the worker entrypoints are compiled." >&2
  exit 1
fi

pnpm --filter @baci/web exec tsx src/scripts/process-import-jobs.ts
