#!/usr/bin/env bash

install_remediation_cron_transition() {
  echo "==> Installing transitional remediation locks before promotion"
  # shellcheck disable=SC2029 # The quoted values intentionally become remote argv.
  ssh "$VPS" "bash -s -- '$REMOTE_DIR' '$NODE_BIN' '$CODEX_REMEDIATOR_IMAGE' '$CODEX_CONTAINER_BIN'" <<'REMOTE_SH'
set -euo pipefail

remote_dir="$1"
node_bin="$2"
codex_image="$3"
codex_container_bin="$4"
lock_dir="$remote_dir/locks"
global_lock="$lock_dir/error-remediator-global.lock"
vercel_lock="$lock_dir/vercel-error-remediator.lock"
sentry_lock="$lock_dir/sentry-mobile-error-remediator.lock"
canary_lock="$lock_dir/remediation-codex-canary.lock"
tmp_file="$(mktemp /tmp/baci-remediation-transition.XXXXXX)"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

install -d -m 700 "$lock_dir"
touch "$global_lock" "$vercel_lock" "$sentry_lock" "$canary_lock"
chmod 600 "$global_lock" "$vercel_lock" "$sentry_lock" "$canary_lock"

# Hold every legacy outer lock until the replacement crontab is installed.
exec 7>"$vercel_lock"
flock -x 7
exec 8>"$sentry_lock"
flock -x 8
exec 9>"$canary_lock"
flock -x 9

python3 - "$remote_dir" "$node_bin" "$codex_image" "$codex_container_bin" > "$tmp_file" <<'PY'
import subprocess
import sys

remote_dir, node_bin, codex_image, codex_container_bin = sys.argv[1:]
existing = subprocess.run(
    ['crontab', '-l'], check=False, stdout=subprocess.PIPE,
    stderr=subprocess.PIPE, text=True,
)
targets = (
    'jobs/vercel-error-remediator.mjs',
    'jobs/sentry-mobile-error-remediator.mjs',
    'jobs/remediation-codex-canary.mjs',
)
if existing.returncode == 0:
    lines = existing.stdout.splitlines()
elif (
    existing.returncode == 1
    and existing.stderr.strip().lower().startswith('no crontab for ')
):
    lines = []
else:
    detail = existing.stderr.strip() or f'exit status {existing.returncode}'
    raise SystemExit(f'unable to read existing crontab: {detail}')
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
