#!/usr/bin/env bash
# Deploy VPS workers to bassey@82.29.190.219
# Usage: bash vps-workers/deploy.sh

set -euo pipefail

VPS="bassey@82.29.190.219"
REMOTE_DIR="/home/bassey/baci-workers"

echo "==> Syncing worker files to $VPS:$REMOTE_DIR"
rsync -av --delete --exclude='.env*' --exclude='node_modules' --exclude='logs' --exclude='locks' \
  vps-workers/ "$VPS:$REMOTE_DIR/"

echo "==> Installing dependencies on VPS"
# Note: commit vps-workers/pnpm-lock.yaml to enable --frozen-lockfile
ssh "$VPS" "cd $REMOTE_DIR && CI=true pnpm install --frozen-lockfile --prod"

echo "==> Creating runtime directories on VPS"
ssh "$VPS" "mkdir -p $REMOTE_DIR/logs $REMOTE_DIR/locks"

echo "==> Installing Vercel drain receiver user service"
cat <<EOF | ssh "$VPS" "mkdir -p ~/.config/systemd/user && cat > ~/.config/systemd/user/baci-vercel-log-drain-receiver.service"
[Unit]
Description=Baci Vercel log drain receiver
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
ExecStart=/usr/bin/node $REMOTE_DIR/jobs/vercel-log-drain-receiver.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
ssh "$VPS" "systemctl --user daemon-reload && systemctl --user enable --now baci-vercel-log-drain-receiver.service"

echo "==> Resolving Node.js path on VPS"
NODE_BIN=$(ssh "$VPS" "command -v node || echo /usr/bin/node")
echo "    Using Node: $NODE_BIN"

echo "==> Installing crontab entries on VPS (idempotent)"
CRON_BLOCK_START="# >>> baci-workers >>>"
CRON_BLOCK_END="# <<< baci-workers <<<"
cat <<EOF | ssh "$VPS" "cat > $REMOTE_DIR/crontab.fragment"
$CRON_BLOCK_START
0,30 * * * * flock -n $REMOTE_DIR/locks/push-receipts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/push-receipts.mjs' >> $REMOTE_DIR/logs/push-receipts.log 2>&1
0 0    * * * flock -n $REMOTE_DIR/locks/cleanup-push-tokens.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/cleanup-push-tokens.mjs' >> $REMOTE_DIR/logs/cleanup-push-tokens.log 2>&1
0 1    * * * flock -n $REMOTE_DIR/locks/cleanup-orders.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/cleanup-orders' >> $REMOTE_DIR/logs/cleanup-orders.log 2>&1
0 3    * * * flock -n $REMOTE_DIR/locks/cleanup-import-uploads.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/cleanup-import-uploads.mjs' >> $REMOTE_DIR/logs/cleanup-import-uploads.log 2>&1
0 5    * * * flock -n $REMOTE_DIR/locks/process-settlements.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/process-settlements' >> $REMOTE_DIR/logs/process-settlements.log 2>&1
*/5 *  * * * flock -n $REMOTE_DIR/locks/reconcile-vtu-processing.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/reconcile-vtu-processing' >> $REMOTE_DIR/logs/reconcile-vtu-processing.log 2>&1
*/15 * * * * flock -n $REMOTE_DIR/locks/vercel-error-remediator.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/vercel-error-remediator.mjs' >> $REMOTE_DIR/logs/vercel-error-remediator.log 2>&1
0 */6  * * * flock -n $REMOTE_DIR/locks/inventory-push-alerts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/inventory/push-alerts' >> $REMOTE_DIR/logs/inventory-push-alerts.log 2>&1
*/5 *  * * * flock -n $REMOTE_DIR/locks/sync-jumia-orders.lock bash -lc 'export NODE_ENV=production && cd $REMOTE_DIR && $REMOTE_DIR/bin/sync-jumia-orders.sh' >> $REMOTE_DIR/logs/sync-jumia-orders.log 2>&1
2-59/5 * * * * flock -n $REMOTE_DIR/locks/process-import-jobs.lock bash -lc 'export NODE_ENV=production && cd $REMOTE_DIR && $REMOTE_DIR/bin/process-import-jobs.sh' >> $REMOTE_DIR/logs/process-import-jobs.log 2>&1
*/2 *  * * * flock -n $REMOTE_DIR/locks/ai-storefront-jobs.lock bash -lc 'export NODE_ENV=production && cd $REMOTE_DIR && $REMOTE_DIR/bin/process-ai-storefront-jobs.sh' >> $REMOTE_DIR/logs/ai-storefront-jobs.log 2>&1
0 2    * * * flock -n $REMOTE_DIR/locks/ai-jobs-worker.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/ai-jobs/worker' >> $REMOTE_DIR/logs/ai-jobs-worker.log 2>&1
0 6    * * * flock -n $REMOTE_DIR/locks/wallet-payouts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/wallet-payouts' >> $REMOTE_DIR/logs/wallet-payouts.log 2>&1
30 8   1 * * flock -n $REMOTE_DIR/locks/vtu-cashback-summaries.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/vtu-cashback-summaries' >> $REMOTE_DIR/logs/vtu-cashback-summaries.log 2>&1
*/15 * * * * flock -n $REMOTE_DIR/locks/publish-scheduled-posts.lock bash -lc 'cd $REMOTE_DIR && $NODE_BIN $REMOTE_DIR/jobs/run-web-cron.mjs /api/cron/publish-scheduled-posts' >> $REMOTE_DIR/logs/publish-scheduled-posts.log 2>&1
$CRON_BLOCK_END
EOF
ssh "$VPS" "bash -s -- '$REMOTE_DIR/crontab.fragment' '$REMOTE_DIR' '$CRON_BLOCK_START' '$CRON_BLOCK_END'" <<'REMOTE_SH'
set -euo pipefail

fragment_path="$1"
remote_dir="$2"
cron_block_start="$3"
cron_block_end="$4"
tmp_file="$(mktemp /tmp/baci-crontab.XXXXXX)"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

python3 - "$fragment_path" "$remote_dir" "$cron_block_start" "$cron_block_end" > "$tmp_file" <<'PY'
import pathlib
import subprocess
import sys

fragment = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
remote_dir = sys.argv[2]
block_start = sys.argv[3]
block_end = sys.argv[4]

existing = subprocess.run(
    ['crontab', '-l'],
    check=False,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
)
lines = existing.stdout.splitlines() if existing.returncode == 0 else []
filtered = []
inside_block = False
for line in lines:
    if line.strip() == block_start:
        inside_block = True
        continue
    if line.strip() == block_end:
        inside_block = False
        continue
    if inside_block:
        continue

    stripped_line = line.lstrip()
    uses_current_worker_paths = (
        f'{remote_dir}/jobs/' in stripped_line
        or f'{remote_dir}/bin/' in stripped_line
    )
    uses_legacy_relative_worker_paths = (
        f'cd {remote_dir}' in stripped_line
        and (' jobs/' in stripped_line or ' bin/' in stripped_line)
    )
    is_baci_worker_command = (
        f'flock -n {remote_dir}/locks/' in stripped_line
        and (uses_current_worker_paths or uses_legacy_relative_worker_paths)
    )
    if is_baci_worker_command:
        continue
    filtered.append(line)

while filtered and not filtered[-1].strip():
    filtered.pop()

if filtered:
    print('\n'.join(filtered))
    print()
print(fragment.rstrip())
PY

if [ ! -s "$tmp_file" ]; then
  echo "Generated crontab is empty; refusing to install." >&2
  exit 1
fi

if ! grep -Fqx "$cron_block_start" "$tmp_file"; then
  echo "Missing start marker in generated crontab ($tmp_file); refusing to install." >&2
  exit 1
fi

if ! grep -Fqx "$cron_block_end" "$tmp_file"; then
  echo "Missing end marker in generated crontab ($tmp_file); refusing to install." >&2
  exit 1
fi

crontab "$tmp_file"
rm -f "$fragment_path"
REMOTE_SH

echo ""
echo "==> Done."
echo "    Reminder: create $REMOTE_DIR/.env if not already present:"
echo "         NEXT_PUBLIC_SUPABASE_URL=..."
echo "         NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
echo "         SUPABASE_SERVICE_ROLE_KEY=..."
echo "         EXPO_ACCESS_TOKEN=..."
echo "         JUMIA_CLIENT_ID=..."
echo "         BACI_WEB_BASE_URL=..."
echo "         CRON_SECRET=..."
echo "         VERCEL_ERROR_LOG_PATH=$REMOTE_DIR/logs/vercel-drain.jsonl"
echo "         BACI_REMEDIATION_OUTPUT_DIR=$REMOTE_DIR/logs/vercel-error-remediator"
echo "         BACI_REMEDIATION_AUTOFIX_ENABLED=0"
echo "         VERCEL_LOG_DRAIN_SECRET=..."
echo "         VERCEL_LOG_DRAIN_RECEIVER_PORT=8787"
echo "         OLLAMA_STOREFRONT_BASE_URL=http://localhost:11434"
echo "         AI_STOREFRONT_GENERATION_ENABLED=false"
