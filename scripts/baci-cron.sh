#!/bin/bash
# VPS Cron Script for Baci
# Deploy to: /home/bassey/scripts/baci-cron.sh
#
# Crontab entries (add with `crontab -e`):
#   # AI worker: POST, uses AI_WORKER_SECRET env var
#   0 2 * * * . /home/bassey/scripts/baci-cron-env.sh && /home/bassey/scripts/baci-cron.sh call_endpoint POST /api/ai-jobs/worker AI_WORKER_SECRET 2>&1 | logger -t baci-cron
#   # Cleanup orders: GET, uses CRON_SECRET env var
#   0 0 * * * . /home/bassey/scripts/baci-cron-env.sh && /home/bassey/scripts/baci-cron.sh call_endpoint GET /api/cron/cleanup-orders CRON_SECRET 2>&1 | logger -t baci-cron
#
# NOTE: No `set -e` — we handle errors explicitly to ensure logging.
set -uo pipefail

DOMAIN="https://ogabassey.com"
LOG_DIR="/home/bassey/logs/baci-cron"
mkdir -p "$LOG_DIR"

# Usage: call_endpoint <method> <path> <secret_env_name>
# The third argument is the NAME of an env var (not the secret itself),
# resolved via indirect expansion to avoid leaking tokens in ps output.
call_endpoint() {
  local method="$1"
  local path="$2"
  local secret_env_name="$3"
  local secret="${!secret_env_name:-}"

  if [ -z "$secret" ]; then
    echo "ERROR: Environment variable $secret_env_name is not set" >&2
    exit 1
  fi

  local logfile="$LOG_DIR/$(basename "$path")-$(date +%Y%m%d).log"
  local bodyfile
  bodyfile=$(mktemp "/tmp/baci-cron-body.XXXXXX")
  local configfile
  configfile=$(mktemp "/tmp/baci-cron-config.XXXXXX")
  chmod 600 "$configfile"

  # Clean up temp files on exit
  trap 'rm -f "$bodyfile" "$configfile"' RETURN

  echo "[$(date -u)] Calling $method $path" >> "$logfile"

  # Write auth header to temp config file (avoids token in process argv)
  printf 'header = "Authorization: Bearer %s"\n' "$secret" > "$configfile"

  # Capture HTTP code separately via -w, write body to temp file.
  HTTP_CODE=$(curl -s --max-time 120 -w "%{http_code}" \
    -X "$method" \
    --config "$configfile" \
    "$DOMAIN$path" -o "$bodyfile" 2>> "$logfile") || {
      echo "[$(date -u)] FAILED: curl error (network/timeout)" >> "$logfile"
      return 1
    }

  if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
    echo "[$(date -u)] FAILED with HTTP $HTTP_CODE" >> "$logfile"
    cat "$bodyfile" >> "$logfile" 2>/dev/null
    return 1
  fi
  echo "[$(date -u)] SUCCESS (HTTP $HTTP_CODE)" >> "$logfile"
}

# Command dispatcher — only allow known commands
case "${1:-}" in
  call_endpoint)
    shift
    if [ $# -lt 3 ]; then
      echo "Usage: $0 call_endpoint <METHOD> <PATH> <SECRET_ENV_NAME>" >&2
      exit 1
    fi
    call_endpoint "$@"
    ;;
  *)
    echo "Usage: $0 call_endpoint <METHOD> <PATH> <SECRET_ENV_NAME>" >&2
    exit 1
    ;;
esac
