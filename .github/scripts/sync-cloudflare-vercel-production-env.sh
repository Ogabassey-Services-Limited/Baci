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

  # Keep values out of argv and logs. Suppress CLI output as a defensive guard:
  # an implementation must never reflect a sensitive stdin value into Actions.
  if ! printf '%s' "$value" | "$vercel_wrapper" env add "$key" production --sensitive --force --yes >/dev/null 2>&1; then
    echo "Failed to synchronize $key to Vercel Production." >&2
    exit 1
  fi
done

echo "Synchronized Cloudflare runtime credential definitions to Vercel Production."
