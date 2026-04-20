#!/usr/bin/env bash
# Deploy VPS workers to bassey@82.29.190.219
# Usage: bash vps-workers/deploy.sh

set -euo pipefail

VPS="bassey@82.29.190.219"
REMOTE_DIR="/home/bassey/baci-workers"

echo "==> Syncing worker files to $VPS:$REMOTE_DIR"
rsync -av --exclude='.env' --exclude='node_modules' \
  vps-workers/ "$VPS:$REMOTE_DIR/"

echo "==> Installing dependencies on VPS"
ssh "$VPS" "cd $REMOTE_DIR && npm install --production"

echo ""
echo "==> Done. Next steps on the VPS:"
echo "    1. Create $REMOTE_DIR/.env with:"
echo "         NEXT_PUBLIC_SUPABASE_URL=..."
echo "         SUPABASE_SERVICE_ROLE_KEY=..."
echo "         EXPO_ACCESS_TOKEN=..."
echo ""
echo "    2. Create log directory:"
echo "         mkdir -p $REMOTE_DIR/logs"
echo ""
echo "    3. Add to crontab (crontab -e):"
echo "         0,30 * * * * /usr/bin/node $REMOTE_DIR/jobs/push-receipts.mjs >> $REMOTE_DIR/logs/push-receipts.log 2>&1"
echo "         0 0 * * *    /usr/bin/node $REMOTE_DIR/jobs/cleanup-push-tokens.mjs >> $REMOTE_DIR/logs/cleanup-push-tokens.log 2>&1"
echo "         0 3 * * *    /usr/bin/node $REMOTE_DIR/jobs/cleanup-import-uploads.mjs >> $REMOTE_DIR/logs/cleanup-import-uploads.log 2>&1"
echo ""
echo "    4. Once crontab is live, remove these from vercel.json crons:"
echo "         /api/cron/push-receipts"
echo "         /api/cron/cleanup-push-tokens"
echo "         /api/cron/cleanup-import-uploads"
