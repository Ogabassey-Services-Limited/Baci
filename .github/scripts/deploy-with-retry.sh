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
# Per-attempt wall-clock cap for the deploy command. Vercel CLI 57's
# `vercel deploy --prebuilt --prod` has been observed to create the deployment
# (READY + URL printed) and then hang without exiting, tying up the self-hosted
# runner for the whole job and holding the deploy concurrency lock. Cap each
# attempt so a hung deploy is terminated; the retry then hits Vercel's duplicate
# custom-deployment-id error and the existing recovery path promotes the
# already-created deployment. Set to 0 to disable the cap.
DEPLOY_ATTEMPT_TIMEOUT_SECONDS=${DEPLOY_ATTEMPT_TIMEOUT_SECONDS:-1200}
# Cap for the promote command so a hung `vercel promote` cannot run forever.
PROMOTE_TIMEOUT_SECONDS=${PROMOTE_TIMEOUT_SECONDS:-300}
deploy_command=("$@")
last_deployment_target=""

# Run "$@" under a wall-clock cap. `timeout` is coreutils (present on the Linux
# deploy runners); `gtimeout` is its Homebrew name on macOS. Where neither
# exists, run without a cap so the script and its tests stay portable.
run_with_timeout() {
  local seconds="$1"
  shift

  if [ "$seconds" -gt 0 ]; then
    if command -v timeout >/dev/null 2>&1; then
      timeout -k 30 "$seconds" "$@"
      return
    fi
    if command -v gtimeout >/dev/null 2>&1; then
      gtimeout -k 30 "$seconds" "$@"
      return
    fi
  fi

  "$@"
}

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

run_promote_command() {
  local first_command
  local second_command
  local third_command

  first_command="$(basename "${deploy_command[0]}")"
  second_command="${deploy_command[1]:-}"
  third_command="${deploy_command[2]:-}"

  if [ "$first_command" = "pnpm" ] && [ "$second_command" = "exec" ] && [ "$third_command" = "vercel" ]; then
    run_with_timeout "$PROMOTE_TIMEOUT_SECONDS" "${deploy_command[0]}" "${deploy_command[1]}" "${deploy_command[2]}" promote "$last_deployment_target" --yes
  elif [ "$first_command" = "npx" ] && [ "$second_command" = "vercel" ]; then
    run_with_timeout "$PROMOTE_TIMEOUT_SECONDS" "${deploy_command[0]}" "${deploy_command[1]}" promote "$last_deployment_target" --yes
  else
    run_with_timeout "$PROMOTE_TIMEOUT_SECONDS" "${deploy_command[0]}" promote "$last_deployment_target" --yes
  fi
}

promote_existing_deployment() {
  if [ -z "$last_deployment_target" ]; then
    echo "Duplicate deployment ID reported, but no deployment URL or ID was observed; refusing to treat retry as success." >&2
    return 1
  fi

  echo "Deploy already exists for this custom deployment ID; promoting existing deployment ${last_deployment_target}."
  if ! run_promote_command; then
    echo "Failed to promote existing deployment ${last_deployment_target}; refusing to treat retry as success." >&2
    return 1
  fi
  echo "Promoted existing deployment for this custom deployment ID; treating retry as recovered success."
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Deploy attempt $attempt/$MAX_ATTEMPTS..."
  attempt_log="$(mktemp)"

  set +e
  run_with_timeout "$DEPLOY_ATTEMPT_TIMEOUT_SECONDS" "${deploy_command[@]}" 2>&1 | tee "$attempt_log"
  status=${PIPESTATUS[0]}
  set -e

  # `timeout` exits 124 when it killed the hung command with TERM, or 137
  # (128+9) when the command was sent KILL -- either the `-k` grace period
  # escalating against a TERM-resistant hang, OR an unrelated OOM/external kill.
  # CLI 57 creates the deployment (READY, URL printed) and then hangs, and a
  # `vercel deploy --prebuilt` RETRY just makes a brand-new deployment (no
  # duplicate-id error), so recover by promoting the deployment this attempt
  # created. If that promote FAILS -- e.g. the attempt was killed for an
  # unrelated reason before the deployment was promotable -- fall through to the
  # normal retry so those failures keep their remaining attempts (status alone
  # cannot tell a `-k` escalation from a child SIGKILL).
  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    echo "Deploy attempt $attempt was killed (status $status: timed out or signalled)." >&2
    timed_out_target="$(extract_deployment_target "$attempt_log" || true)"
    if [ -n "$timed_out_target" ]; then
      last_deployment_target="$timed_out_target"
      echo "Promoting the deployment it created: ${last_deployment_target}..."
      if run_promote_command; then
        echo "Recovered killed deploy by promoting ${last_deployment_target} to production."
        rm -f "$attempt_log"
        exit 0
      fi
      echo "Could not promote ${last_deployment_target}; treating as a normal failure." >&2
    fi
    # No promotable deployment -- fall through to the duplicate-id check / retry.
  fi

  if [ "$status" -eq 0 ]; then
    echo "Deploy succeeded on attempt $attempt"
    # Vercel stopped auto-assigning the production domains to `--prod` deploys
    # (observed 2026-07-23): the deploy now lands as production but the domains
    # stay on the previous deployment until it is promoted. Promote the
    # just-created deployment so the production domains follow every deploy
    # instead of silently freezing. Idempotent if Vercel restores auto-assign.
    # Extract the target from THIS successful attempt only -- never fall back to
    # a URL retained from an earlier failed attempt (remember_deployment_target
    # keeps prior state), which would promote the wrong deployment when a retry
    # succeeds without re-emitting a parseable target.
    last_deployment_target="$(extract_deployment_target "$attempt_log" || true)"
    rm -f "$attempt_log"
    if [ -z "$last_deployment_target" ]; then
      echo "Deploy succeeded but no deployment URL/ID was observed to promote." >&2
      exit 1
    fi
    echo "Promoting deployment ${last_deployment_target} to production..."
    if ! run_promote_command; then
      echo "Deploy succeeded but promote failed for ${last_deployment_target}." >&2
      exit 1
    fi
    echo "Promoted ${last_deployment_target} to production."
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
