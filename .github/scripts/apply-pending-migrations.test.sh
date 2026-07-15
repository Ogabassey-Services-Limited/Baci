#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
applier="$script_dir/apply-pending-migrations.sh"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

fake_bin="$fixture_root/bin"
mkdir -p "$fake_bin"

cat >"$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"
printf '%s\n' "$payload" >>"$FAKE_QUERY_LOG"
if jq -e '.query | startswith("SELECT version, name")' >/dev/null <<<"$payload"; then
  printf '%s\n' "$FAKE_INITIAL_RESPONSE"
else
  printf '%s\n' '[]'
fi
FAKE_CURL
chmod +x "$fake_bin/curl"

make_collision_fixture() {
  local directory="$1"
  mkdir -p "$directory"
  printf '%s\n' "SELECT 'paystack';" >"$directory/20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql"
  printf '%s\n' "SELECT 'quiz';" >"$directory/20260713130000_quiz_finalize_rank_winners.sql"
  printf '%s\n' "SELECT 'repair';" >"$directory/20260713140000_quiz_finalize_rank_winners_reapply.sql"
}

fresh_dir="$fixture_root/fresh"
make_collision_fixture "$fresh_dir"
fresh_log="$fixture_root/fresh-queries.log"
fresh_output="$fixture_root/fresh-output.log"
PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$fresh_dir" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$fresh_log" \
  FAKE_INITIAL_RESPONSE='[]' \
  bash "$applier" >"$fresh_output"

grep -q 'applied:         20260713130000  add_storefront_paystack_subaccount_configured_rpc' "$fresh_output"
grep -q 'already applied: 20260713130000  quiz_finalize_rank_winners' "$fresh_output"
grep -q 'reconciled by repair migration 20260713140000' "$fresh_output"
grep -q 'applied:         20260713140000  quiz_finalize_rank_winners_reapply' "$fresh_output"
if [ "$(grep -c "schema_migrations(version, name, statements).*20260713130000" "$fresh_log")" -ne 1 ]; then
  echo 'Expected the historical collision version to be registered exactly once' >&2
  exit 1
fi

invalid_dir="$fixture_root/invalid"
make_collision_fixture "$invalid_dir"
invalid_log="$fixture_root/invalid-queries.log"
if PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$invalid_dir" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$invalid_log" \
  FAKE_INITIAL_RESPONSE='[{"version":"20260713130000","name":"unexpected"}]' \
  bash "$applier" >"$fixture_root/invalid-output.log" 2>&1; then
  echo 'Expected an unexpected recorded collision name to fail closed' >&2
  exit 1
fi
grep -q 'unexpected recorded/current name pair' "$fixture_root/invalid-output.log"

renamed_dir="$fixture_root/renamed"
mkdir -p "$renamed_dir"
printf '%s\n' "SELECT 'current';" >"$renamed_dir/20260101000000_current.sql"
renamed_log="$fixture_root/renamed-queries.log"
if PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$renamed_dir" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$renamed_log" \
  FAKE_INITIAL_RESPONSE='[{"version":"20260101000000","name":"recorded"}]' \
  bash "$applier" >"$fixture_root/renamed-output.log" 2>&1; then
  echo 'Expected a non-collision version/name mismatch to fail closed' >&2
  exit 1
fi
grep -q "recorded as 'recorded', not current file 'current'" "$fixture_root/renamed-output.log"

echo 'Migration applier collision tests passed'
