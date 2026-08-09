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

python3 - "$remote_dir" "$node_bin" "${BACI_REMEDIATION_LEGACY_DRAIN_TIMEOUT_SECONDS:-60}" <<'PY'
import os
import shlex
import subprocess
import sys
import time

remote_dir, node_bin, timeout_value = sys.argv[1:]
try:
    timeout_seconds = min(max(int(timeout_value), 1), 60)
except ValueError:
    timeout_seconds = 60

targets = {
    f'{remote_dir}/jobs/vercel-error-remediator.mjs',
    f'{remote_dir}/jobs/sentry-mobile-error-remediator.mjs',
    f'{remote_dir}/jobs/remediation-codex-canary.mjs',
}
relative_targets = {target.removeprefix(f'{remote_dir}/') for target in targets}
node_path = os.path.realpath(node_bin)

def active_legacy_direct_processes():
    listing = subprocess.run(
        ['ps', '-eo', 'pid=,args='], check=True, stdout=subprocess.PIPE, text=True
    )
    active = []
    for line in listing.stdout.splitlines():
        pid_text, _, command = line.strip().partition(' ')
        try:
            pid = int(pid_text)
            arguments = shlex.split(command)
        except ValueError:
            continue
        if pid == os.getpid() or not arguments:
            continue
        if os.path.realpath(arguments[0]) != node_path:
            continue
        scripts = set(arguments[1:])
        if scripts & targets:
            active.append(pid)
            continue
        if not scripts & relative_targets:
            continue
        try:
            if os.path.realpath(os.readlink(f'/proc/{pid}/cwd')) == remote_dir:
                active.append(pid)
        except OSError:
            continue
    return active

deadline = time.monotonic() + timeout_seconds
while active_legacy_direct_processes():
    if time.monotonic() >= deadline:
        raise SystemExit(
            'legacy direct remediation processes did not drain before crontab rewrite'
        )
    time.sleep(1)
PY

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
