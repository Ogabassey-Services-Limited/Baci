#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="$script_dir/check-migration-versions.sh"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

make_fixture() {
  local name="$1"
  shift
  local directory="$fixture_root/$name"
  mkdir -p "$directory"
  for file in "$@"; do
    touch "$directory/$file"
  done
  printf '%s\n' "$directory"
}

unique_dir="$(make_fixture unique \
  20260101000000_first.sql \
  20260101000001_second.sql)"
bash "$checker" "$unique_dir"

legacy_dir="$(make_fixture legacy \
  20260615120000_customer_order_cancellation.sql \
  20260615120000_register_push_token_rpc.sql \
  20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql \
  20260713130000_quiz_finalize_rank_winners.sql)"
bash "$checker" "$legacy_dir"

unexpected_dir="$(make_fixture unexpected \
  20260101000000_first.sql \
  20260101000000_second.sql)"
if bash "$checker" "$unexpected_dir" >"$fixture_root/unexpected.log" 2>&1; then
  echo "Expected an unapproved duplicate version to fail" >&2
  exit 1
fi
grep -q "20260101000000" "$fixture_root/unexpected.log"

expanded_legacy_dir="$(make_fixture expanded-legacy \
  20260615120000_customer_order_cancellation.sql \
  20260615120000_register_push_token_rpc.sql \
  20260615120000_third_collision.sql)"
if bash "$checker" "$expanded_legacy_dir" >"$fixture_root/expanded-legacy.log" 2>&1; then
  echo "Expected an expanded historical collision to fail" >&2
  exit 1
fi
grep -q "20260615120000" "$fixture_root/expanded-legacy.log"

echo "Migration version checks passed"
