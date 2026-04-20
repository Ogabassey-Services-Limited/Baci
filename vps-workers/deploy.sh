#!/usr/bin/env bash
# Deploy VPS workers to bassey@82.29.190.219
# Usage: bash vps-workers/deploy.sh

set -euo pipefail

VPS="bassey@82.29.190.219"
REMOTE_DIR="/home/bassey/baci-workers"

echo "==> Syncing worker files to $VPS:$REMOTE_DIR"
rsync -av --delete --exclude='.env' --exclude='node_modules' \
  vps-workers/ "$VPS:$REMOTE_DIR/"

echo "==> Installing dependencies on VPS"
# Note: commit vps-workers/pnpm-lock.yaml to enable --frozen-lockfile
ssh "$VPS" "cd $REMOTE_DIR && pnpm install --frozen-lockfile --prod"

echo "==> Creating log directory on VPS"
ssh "$VPS" "mkdir -p $REMOTE_DIR/logs"

echo "==> Installing crontab entries on VPS (idempotent)"
cat <<EOF | ssh "$VPS" "cat > $REMOTE_DIR/crontab.fragment"
0,30 * * * * cd $REMOTE_DIR && /usr/bin/node $REMOTE_DIR/jobs/push-receipts.mjs >> $REMOTE_DIR/logs/push-receipts.log 2>&1
0 0    * * * cd $REMOTE_DIR && /usr/bin/node $REMOTE_DIR/jobs/cleanup-push-tokens.mjs >> $REMOTE_DIR/logs/cleanup-push-tokens.log 2>&1
0 3    * * * cd $REMOTE_DIR && /usr/bin/node $REMOTE_DIR/jobs/cleanup-import-uploads.mjs >> $REMOTE_DIR/logs/cleanup-import-uploads.log 2>&1
EOF
ssh "$VPS" "(crontab -l 2>/dev/null | grep -v '$REMOTE_DIR/jobs/'; cat $REMOTE_DIR/crontab.fragment) | crontab -"

echo ""
echo "==> Done."
echo "    Crontab entries installed. Once verified, remove these from vercel.json crons:"
echo "         /api/cron/push-receipts"
echo "         /api/cron/cleanup-push-tokens"
echo "         /api/cron/cleanup-import-uploads"
echo ""
echo "    Reminder: create $REMOTE_DIR/.env if not already present:"
echo "         NEXT_PUBLIC_SUPABASE_URL=..."
echo "         SUPABASE_SERVICE_ROLE_KEY=..."
echo "         EXPO_ACCESS_TOKEN=..."
