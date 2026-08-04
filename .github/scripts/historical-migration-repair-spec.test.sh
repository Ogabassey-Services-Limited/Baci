#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

make_applier_fixture() {
  local directory="$1"
  mkdir -p "$directory/migrations"
  cp "$script_dir/apply-pending-migrations.sh" "$directory/"
  cp "$script_dir/check-migration-versions.sh" "$directory/"
  printf 'SELECT 1;\n' >"$directory/migrations/20260101000000_probe.sql"
}

missing_spec_dir="$fixture_root/missing-spec"
make_applier_fixture "$missing_spec_dir"
if MIGRATIONS_DIR="$missing_spec_dir/migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  bash "$missing_spec_dir/apply-pending-migrations.sh" \
  >"$fixture_root/missing-spec-output.log" 2>&1; then
  echo 'Expected a missing historical repair specification to fail closed' >&2
  exit 1
fi
grep -q 'historical repair specification not found' \
  "$fixture_root/missing-spec-output.log"

missing_function_dir="$fixture_root/missing-function"
make_applier_fixture "$missing_function_dir"
printf ':\n' >"$missing_function_dir/historical-migration-repair-spec.sh"
if MIGRATIONS_DIR="$missing_function_dir/migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  bash "$missing_function_dir/apply-pending-migrations.sh" \
  >"$fixture_root/missing-function-output.log" 2>&1; then
  echo 'Expected a repair specification without its resolver to fail closed' >&2
  exit 1
fi
grep -q 'historical_migration_repair_spec not defined' \
  "$fixture_root/missing-function-output.log"

echo 'Historical migration repair specification loader tests passed'
