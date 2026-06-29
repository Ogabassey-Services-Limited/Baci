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
deploy_command=("$@")
last_deployment_target=""

is_duplicate_custom_deployment_id_error() {
  local log_file="$1"

  grep -Eiq \
    '((custom[[:space:]-]+)?deployment[[:space:]-]+id|NEXT_DEPLOYMENT_ID|deploymentId).*(already|duplicate|exists|used)' \
    "$log_file"
}

extract_deployment_target() {
  local log_file="$1"

  grep -Eo '(https://[^[:space:]]+\.vercel\.app|dpl_[A-Za-z0-9_-]+)' "$log_file" \
    | sed 's/[),.;]*$//' \
    | tail -n 1
}

remember_deployment_target() {
  local log_file="$1"
  local deployment_target

  deployment_target="$(extract_deployment_target "$log_file" || true)"
  if [ -n "$deployment_target" ]; then
    last_deployment_target="$deployment_target"
  fi
}

promote_existing_deployment() {
  if [ -z "$last_deployment_target" ]; then
    echo "Duplicate deployment ID reported, but no deployment URL or ID was observed; refusing to treat retry as success." >&2
    return 1
  fi

  echo "Deploy already exists for this custom deployment ID; promoting existing deployment ${last_deployment_target}."
  if ! "${deploy_command[0]}" promote "$last_deployment_target" --yes; then
    echo "Failed to promote existing deployment ${last_deployment_target}; refusing to treat retry as success." >&2
    return 1
  fi
  echo "Promoted existing deployment for this custom deployment ID; treating retry as recovered success."
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Deploy attempt $attempt/$MAX_ATTEMPTS..."
  attempt_log="$(mktemp)"

  set +e
  "${deploy_command[@]}" > >(tee "$attempt_log") 2> >(tee -a "$attempt_log" >&2)
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$attempt_log"
    echo "Deploy succeeded on attempt $attempt"
    exit 0
  fi

  remember_deployment_target "$attempt_log"

  if is_duplicate_custom_deployment_id_error "$attempt_log"; then
    if promote_existing_deployment; then
      rm -f "$attempt_log"
      exit 0
    fi
  fi

  rm -f "$attempt_log"

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    echo "Deploy failed, retrying in ${BACKOFF_SECONDS}s..."
    sleep "$BACKOFF_SECONDS"
  fi
done

echo "Deploy failed after $MAX_ATTEMPTS attempts"
exit 1
