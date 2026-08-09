#!/usr/bin/env bash

install_remediation_cron_transition() {
  echo "==> Installing transitional remediation locks before promotion"
  ssh "$VPS" "bash -s -- '$REMOTE_DIR' '$NODE_BIN' '$CODEX_REMEDIATOR_IMAGE' '$CODEX_CONTAINER_BIN'" <<'REMOTE_SH'
set -euo pipefail

remote_dir="$1"
node_bin="$2"
codex_image="$3"
codex_container_bin="$4"
lock_dir="$remote_dir/locks"
global_lock="$lock_dir/error-remediator-global.lock"
tmp_file="$(mktemp /tmp/baci-remediation-transition.XXXXXX)"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

install -d -m 700 "$lock_dir"
touch "$global_lock"
chmod 600 "$global_lock"

python3 - "$remote_dir" "$node_bin" "$codex_image" "$codex_container_bin" > "$tmp_file" <<'PY'
import subprocess
import sys

remote_dir, node_bin, codex_image, codex_container_bin = sys.argv[1:]
existing = subprocess.run(
    ['crontab', '-l'], check=False, stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL, text=True,
)
targets = (
    'jobs/vercel-error-remediator.mjs',
    'jobs/sentry-mobile-error-remediator.mjs',
    'jobs/remediation-codex-canary.mjs',
)
lines = existing.stdout.splitlines() if existing.returncode == 0 else []
for line in lines:
    if not any(target in line for target in targets):
        print(line)

base = f'export BACI_CODEX_DOCKER_IMAGE={codex_image} BACI_CODEX_CONTAINER_BIN={codex_container_bin} && cd {remote_dir} && exec flock -F '
print(f"*/15 * * * * flock -n {remote_dir}/locks/vercel-error-remediator.lock bash -lc '{base}-n -E 75 {remote_dir}/locks/error-remediator-global.lock {node_bin} {remote_dir}/jobs/vercel-error-remediator.mjs' >> {remote_dir}/logs/vercel-error-remediator.log 2>&1")
print(f"*/5 *  * * * flock -n {remote_dir}/locks/sentry-mobile-error-remediator.lock bash -lc '{base}-n -E 75 {remote_dir}/locks/error-remediator-global.lock {node_bin} {remote_dir}/jobs/sentry-mobile-error-remediator.mjs' >> {remote_dir}/logs/sentry-mobile-error-remediator.log 2>&1")
print(f"22 4   * * * flock -n {remote_dir}/locks/remediation-codex-canary.lock bash -lc '{base}-w 600 -E 75 {remote_dir}/locks/error-remediator-global.lock {node_bin} {remote_dir}/jobs/remediation-codex-canary.mjs' >> {remote_dir}/logs/remediation-codex-canary.log 2>&1")
PY

crontab "$tmp_file"
REMOTE_SH
}
