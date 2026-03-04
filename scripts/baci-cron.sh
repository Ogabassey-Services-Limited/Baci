#!/bin/bash
# VPS Cron Script for Baci
# Deploy to: /home/bassey/scripts/baci-cron.sh
#
# Crontab entries (add with `crontab -e`):
#   # AI worker: POST, uses AI_WORKER_SECRET
#   0 2 * * * /home/bassey/scripts/baci-cron.sh call_endpoint POST /api/ai-jobs/worker "$AI_WORKER_SECRET" 2>&1 | logger -t baci-cron
#   # Cleanup orders: GET, uses CRON_SECRET
#   0 0 * * * /home/bassey/scripts/baci-cron.sh call_endpoint GET /api/cron/cleanup-orders "$CRON_SECRET" 2>&1 | logger -t baci-cron
#
# NOTE: No `set -e` — we handle errors explicitly to ensure logging.
set -uo pipefail

DOMAIN="https://ogabassey.com"
LOG_DIR="/home/bassey/logs/baci-cron"
mkdir -p "$LOG_DIR"

# Usage: call_endpoint <method> <path> <secret>
call_endpoint() {
  local method="$1"
  local path="$2"
  local secret="$3"
  local logfile="$LOG_DIR/$(basename "$path")-$(date +%Y%m%d).log"

  echo "[$(date -u)] Calling $method $path" >> "$logfile"

  # Capture HTTP code separately via -w, write body to file, stderr to log.
  HTTP_CODE=$(curl -s --max-time 120 -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer $secret" \
    "$DOMAIN$path" -o "$logfile.body" 2>> "$logfile") || {
      echo "[$(date -u)] FAILED: curl error (network/timeout)" >> "$logfile"
      exit 1
    }

  if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
    echo "[$(date -u)] FAILED with HTTP $HTTP_CODE" >> "$logfile"
    cat "$logfile.body" >> "$logfile" 2>/dev/null
    exit 1
  fi
  echo "[$(date -u)] SUCCESS (HTTP $HTTP_CODE)" >> "$logfile"
}

"$@"
