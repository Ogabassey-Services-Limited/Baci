#!/usr/bin/env bash
# Deploy VPS workers to bassey@82.29.190.219
# Usage: bash vps-workers/deploy.sh

set -euo pipefail

VPS="bassey@82.29.190.219"
REMOTE_DIR="/home/bassey/baci-workers"

echo "==> Syncing worker files to $VPS:$REMOTE_DIR"
rsync -av --delete --exclude='.env*' --exclude='node_modules' --exclude='logs' \
  vps-workers/ "$VPS:$REMOTE_DIR/"

echo "==> Installing dependencies on VPS"
# Note: commit vps-workers/pnpm-lock.yaml to enable --frozen-lockfile
ssh "$VPS" "cd $REMOTE_DIR && CI=true pnpm install --frozen-lockfile --prod"

echo "==> Creating runtime directories on VPS"
ssh "$VPS" "mkdir -p $REMOTE_DIR/logs $REMOTE_DIR/locks"

echo "==> Resolving Node.js path on VPS"
NODE_BIN=$(ssh "$VPS" "command -v node || echo /usr/bin/node")
echo "    Using Node: $NODE_BIN"

echo "==> Installing crontab entries on VPS (idempotent)"
cat <<EOF | ssh "$VPS" "cat > $REMOTE_DIR/crontab.fragment"
0,30 * * * * flock -n $REMOTE_DIR/locks/push-receipts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/push-receipts.mjs' >> $REMOTE_DIR/logs/push-receipts.log 2>&1
0 0    * * * flock -n $REMOTE_DIR/locks/cleanup-push-tokens.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/cleanup-push-tokens.mjs' >> $REMOTE_DIR/logs/cleanup-push-tokens.log 2>&1
0 3    * * * flock -n $REMOTE_DIR/locks/cleanup-import-uploads.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/cleanup-import-uploads.mjs' >> $REMOTE_DIR/logs/cleanup-import-uploads.log 2>&1
0 */6  * * * flock -n $REMOTE_DIR/locks/inventory-push-alerts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/inventory-push-alerts.mjs' >> $REMOTE_DIR/logs/inventory-push-alerts.log 2>&1
*/5 *  * * * flock -n $REMOTE_DIR/locks/sync-jumia-orders.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/sync-jumia-orders.mjs' >> $REMOTE_DIR/logs/sync-jumia-orders.log 2>&1
*/5 *  * * * flock -n $REMOTE_DIR/locks/process-import-jobs.lock bash -lc 'export NODE_ENV=production && cd $REMOTE_DIR && $REMOTE_DIR/bin/process-import-jobs.sh' >> $REMOTE_DIR/logs/process-import-jobs.log 2>&1
EOF
ssh "$VPS" "(crontab -l 2>/dev/null | grep -v '$REMOTE_DIR/jobs/' | grep -v '$REMOTE_DIR/bin/process-import-jobs.sh'; cat $REMOTE_DIR/crontab.fragment) | crontab -"

echo ""
echo "==> Done."
echo "    Reminder: create $REMOTE_DIR/.env if not already present:"
echo "         NEXT_PUBLIC_SUPABASE_URL=..."
echo "         NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
echo "         SUPABASE_SERVICE_ROLE_KEY=..."
echo "         EXPO_ACCESS_TOKEN=..."
echo "         JUMIA_CLIENT_ID=..."
