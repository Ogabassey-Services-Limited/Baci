#!/usr/bin/env bash
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 [pnpm install args...]"
  exit 1
fi

MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}
BACKOFF_SECONDS=${BACKOFF_SECONDS:-10}
STORE_DIR=${PNPM_STORE_DIR:-}

cleanup_install_artifacts() {
  echo "Cleaning install artifacts before retry..."
  rm -rf node_modules apps/*/node_modules packages/*/node_modules

  if [ -n "$STORE_DIR" ]; then
    rm -rf "$STORE_DIR"
    pnpm config set store-dir "$STORE_DIR"
  fi
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "pnpm install attempt $attempt/$MAX_ATTEMPTS..."
  log_file=$(mktemp)

  if pnpm install "$@" 2>&1 | tee "$log_file"; then
    rm -f "$log_file"
    echo "pnpm install succeeded on attempt $attempt"
    exit 0
  fi

  should_retry=false
  if grep -q "ERR_PNPM_ENOENT" "$log_file"; then
    should_retry=true
  fi

  rm -f "$log_file"

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ] || [ "$should_retry" != true ]; then
    echo "pnpm install failed after $attempt attempt(s)"
    exit 1
  fi

  cleanup_install_artifacts
  echo "Retrying pnpm install in ${BACKOFF_SECONDS}s..."
  sleep "$BACKOFF_SECONDS"
done
