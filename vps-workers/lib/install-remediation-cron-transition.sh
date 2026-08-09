#!/usr/bin/env bash

install_remediation_cron_transition() {
  echo "==> Transactionally installing the remediation launch barrier"
  # shellcheck disable=SC2029 # The quoted values intentionally become remote argv.
  ssh "$VPS" "flock -x /tmp/baci-workers-deploy.lock bash -s -- '$REMOTE_DIR' '$STAGING_DIR' '$NODE_BIN' '$CODEX_REMEDIATOR_IMAGE' '$CODEX_CONTAINER_BIN' '${BACI_REMEDIATION_LEGACY_DRAIN_TIMEOUT_SECONDS:-60}'" <<'REMOTE_SH'
set -euo pipefail

remote_dir="$1"
staging_dir="$2"
node_bin="$3"
codex_image="$4"
codex_container_bin="$5"
drain_timeout="$6"
lock_dir="$remote_dir/locks"

install -d -m 700 "$lock_dir"
for lock_name in \
  error-remediator-global \
  vercel-error-remediator \
  sentry-mobile-error-remediator \
  remediation-codex-canary
do
  touch "$lock_dir/$lock_name.lock"
  chmod 600 "$lock_dir/$lock_name.lock"
done

# New entrypoints use the global lock, so holding it before installing their
# staged copies closes the direct-launch race before the legacy drain starts.
exec 6>"$lock_dir/error-remediator-global.lock"
flock -x 6
exec 7>"$lock_dir/vercel-error-remediator.lock"
flock -x 7
exec 8>"$lock_dir/sentry-mobile-error-remediator.lock"
flock -x 8
exec 9>"$lock_dir/remediation-codex-canary.lock"
flock -x 9

python3 "$staging_dir/lib/remediation-cron-transition.py" \
  "$remote_dir" "$staging_dir" "$node_bin" "$codex_image" \
  "$codex_container_bin" "$drain_timeout" "${BACI_REMEDIATION_PROC_ROOT:-/proc}"
REMOTE_SH
}
