#!/usr/bin/env bash

set -euo pipefail

migrations_dir="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/supabase/migrations}"

if [ ! -d "$migrations_dir" ]; then
  echo "::error::Migration directory not found: $migrations_dir" >&2
  exit 1
fi

shopt -s nullglob
files=("$migrations_dir"/*.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files found in $migrations_dir"
  exit 0
fi

versions_file="$(mktemp)"
trap 'rm -f "$versions_file"' EXIT

for file in "${files[@]}"; do
  filename="${file##*/}"
  base="${filename%.sql}"
  version="${base%%_*}"
  if [[ ! "$base" =~ ^[0-9]{14}_.+$ ]]; then
    echo "::error::Invalid migration filename: $filename" >&2
    exit 1
  fi
  printf '%s|%s\n' "$version" "$filename" >>"$versions_file"
done

duplicate_versions="$(cut -d '|' -f 1 "$versions_file" | sort | uniq -d)"
if [ -z "$duplicate_versions" ]; then
  echo "Migration versions are unique"
  exit 0
fi

failed=0
while IFS= read -r version; do
  [ -n "$version" ] || continue
  names="$(awk -F '|' -v version="$version" '$1 == version { print $2 }' "$versions_file" | sort | paste -sd ',' -)"
  collision="$version:$names"

  case "$collision" in
    "20260615120000:20260615120000_customer_order_cancellation.sql,20260615120000_register_push_token_rpc.sql" | \
    "20260713130000:20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql,20260713130000_quiz_finalize_rank_winners.sql")
      echo "::warning::Allowing exact historical migration collision $version: $names"
      ;;
    *)
      echo "::error::Duplicate migration version $version: $names" >&2
      failed=1
      ;;
  esac
done <<<"$duplicate_versions"

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "Migration versions contain only approved historical collisions"
