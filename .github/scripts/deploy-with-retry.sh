#!/usr/bin/env bash
# IMPORTANT: --archive=tgz is required to prevent Vercel upload rate limiting.
# Do NOT remove it — without it, each deploy uploads thousands of individual files.
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command> [args...]"
  exit 1
fi

MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}
BACKOFF_SECONDS=${BACKOFF_SECONDS:-15}

is_duplicate_custom_deployment_id_error() {
  local log_file="$1"

  grep -Eiq \
    '((custom[[:space:]-]+)?deployment[[:space:]-]+id|NEXT_DEPLOYMENT_ID|deploymentId).*(already|duplicate|exists|used)' \
    "$log_file"
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Deploy attempt $attempt/$MAX_ATTEMPTS..."
  attempt_log="$(mktemp)"

  set +e
  "$@" > >(tee "$attempt_log") 2> >(tee -a "$attempt_log" >&2)
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$attempt_log"
    echo "Deploy succeeded on attempt $attempt"
    exit 0
  fi

  if is_duplicate_custom_deployment_id_error "$attempt_log"; then
    rm -f "$attempt_log"
    echo "Deploy already exists for this custom deployment ID; treating retry as recovered success."
    exit 0
  fi

  rm -f "$attempt_log"

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    echo "Deploy failed, retrying in ${BACKOFF_SECONDS}s..."
    sleep "$BACKOFF_SECONDS"
  fi
done

echo "Deploy failed after $MAX_ATTEMPTS attempts"
exit 1
