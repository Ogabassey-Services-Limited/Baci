#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <pinned-vercel-wrapper>" >&2
  exit 64
fi

vercel_wrapper="$1"
readonly -a cloudflare_keys=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ZONE_ID
)

runtime_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
sync_directory=$(mktemp -d "$runtime_root/baci-vercel-env-sync.XXXXXX")
chmod 0700 "$sync_directory"
trap 'rm -rf "$sync_directory"' EXIT

update_report_is_missing() {
  node - "$1" <<'NODE'
const { readFileSync } = require('node:fs');

try {
  const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  process.exit(report?.status === 'error' && report?.reason === 'env_not_found' ? 0 : 1);
} catch {
  process.exit(1);
}
NODE
}

# Check every required input before mutating Vercel. This prevents a partial
# update from leaving one runtime credential current while the other is blank.
for key in "${cloudflare_keys[@]}"; do
  value="${!key-}"
  if [[ -z "${value//[[:space:]]/}" ]]; then
    echo "$key must be configured and non-blank before synchronizing Vercel Production." >&2
    exit 1
  fi
done

for key in "${cloudflare_keys[@]}"; do
  value="${!key}"
  update_stdout="$sync_directory/update.stdout"
  update_stderr="$sync_directory/update.stderr"
  : >"$update_stdout"
  : >"$update_stderr"
  chmod 0600 "$update_stdout" "$update_stderr"

  # Keep values out of argv and logs. Suppress CLI output as a defensive guard:
  # an implementation must never reflect a sensitive stdin value into Actions.
  if printf '%s' "$value" | "$vercel_wrapper" env update "$key" production --sensitive --yes --non-interactive >"$update_stdout" 2>"$update_stderr"; then
    continue
  fi

  if ! update_report_is_missing "$update_stdout"; then
    echo "Failed to update $key in Vercel Production." >&2
    exit 1
  fi

  if ! printf '%s' "$value" | "$vercel_wrapper" env add "$key" production --sensitive --yes --non-interactive >/dev/null 2>&1; then
    echo "Failed to synchronize $key to Vercel Production." >&2
    exit 1
  fi
done

echo "Synchronized Cloudflare runtime credential definitions to Vercel Production."
