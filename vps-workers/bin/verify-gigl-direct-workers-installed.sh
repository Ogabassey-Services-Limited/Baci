#!/usr/bin/env bash

set -euo pipefail

remote_dir="${VPS_WORKER_REMOTE_DIR:-/home/bassey/baci-workers}"

echo "==> Verifying production GIGL direct workers on the deploy runner"

for wrapper in \
  "$remote_dir/bin/process-gigl-tracking.sh" \
  "$remote_dir/bin/process-gigl-tracking-notifications.sh"
do
  if [ ! -x "$wrapper" ]; then
    echo "Missing or non-executable GIGL direct-worker wrapper: $wrapper" >&2
    exit 1
  fi
done

if ! installed_crontab="$(crontab -l 2>/dev/null)"; then
  echo "The VPS worker crontab is not installed." >&2
  exit 1
fi

tracking_counts="$(
  printf '%s\n' "$installed_crontab" | awk -v remote_dir="$remote_dir" '
    function command_after_schedule(line, field_index) {
      for (field_index = 0; field_index < 5; field_index += 1) {
        sub(/^[[:space:]]*[^[:space:]]+[[:space:]]+/, "", line)
      }
      return line
    }
    BEGIN {
      quote = sprintf("%c", 39)
      expected_command = "flock -n " remote_dir "/locks/gigl-tracking.lock bash -lc " quote \
        "export NODE_ENV=production && export BACI_WORKER_PROFILE=gigl-tracking && cd " remote_dir \
        " && timeout --signal=TERM --kill-after=30s 2m " remote_dir "/bin/process-gigl-tracking.sh" quote \
        " >> " remote_dir "/logs/gigl-tracking.log 2>&1"
    }
    $1 !~ /^#/ && index($0, remote_dir "/bin/process-gigl-tracking.sh") {
      total += 1
      if ($1 == "*/5" && $2 == "*" && $3 == "*" && $4 == "*" && $5 == "*" &&
          command_after_schedule($0) == expected_command) {
        canonical += 1
      }
    }
    END { print total + 0, canonical + 0 }
  '
)"
tracking_total="${tracking_counts%% *}"
tracking_canonical="${tracking_counts##* }"

notification_counts="$(
  printf '%s\n' "$installed_crontab" | awk -v remote_dir="$remote_dir" '
    function command_after_schedule(line, field_index) {
      for (field_index = 0; field_index < 5; field_index += 1) {
        sub(/^[[:space:]]*[^[:space:]]+[[:space:]]+/, "", line)
      }
      return line
    }
    BEGIN {
      quote = sprintf("%c", 39)
      expected_command = "flock -n " remote_dir "/locks/gigl-tracking-notifications.lock bash -lc " quote \
        "export NODE_ENV=production && export BACI_WORKER_PROFILE=gigl-tracking-notifications && cd " remote_dir \
        " && timeout --signal=TERM --kill-after=30s 2m " remote_dir "/bin/process-gigl-tracking-notifications.sh" quote \
        " >> " remote_dir "/logs/gigl-tracking-notifications.log 2>&1"
    }
    $1 !~ /^#/ && index($0, remote_dir "/bin/process-gigl-tracking-notifications.sh") {
      total += 1
      if ($1 == "*/10" && $2 == "*" && $3 == "*" && $4 == "*" && $5 == "*" &&
          command_after_schedule($0) == expected_command) {
        canonical += 1
      }
    }
    END { print total + 0, canonical + 0 }
  '
)"
notification_total="${notification_counts%% *}"
notification_canonical="${notification_counts##* }"

if [ "$tracking_total" -ne 1 ] || [ "$tracking_canonical" -ne 1 ] || \
   [ "$notification_total" -ne 1 ] || [ "$notification_canonical" -ne 1 ]; then
  echo "Expected one canonical GIGL tracking schedule and one notification schedule; found tracking $tracking_total total/$tracking_canonical canonical and notifications $notification_total total/$notification_canonical canonical." >&2
  echo "Run bash vps-workers/deploy.sh from a clean exact-SHA checkout, then rerun production deployment." >&2
  exit 1
fi

echo "GIGL direct workers are installed."
