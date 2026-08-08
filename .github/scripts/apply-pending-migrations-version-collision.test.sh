#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
applier="$script_dir/apply-pending-migrations.sh"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

fake_bin="$fixture_root/bin"
migrations="$fixture_root/migrations"
query_log="$fixture_root/queries.log"
mkdir -p "$fake_bin" "$migrations"

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

printf '%s\n' "SELECT 'colliding paystack source';" \
  >"$migrations/20260805090000_complete_merchant_invoice_partial_payments.sql"
printf '%s\n' "SELECT 'review contract repair';" \
  >"$migrations/20260805090001_reapply_merchant_invoice_partial_review_contract.sql"
printf '%s\n' "SELECT 'completion function repair';" \
  >"$migrations/20260805090002_reapply_complete_merchant_invoice_partial_payment.sql"

PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$query_log" \
  FAKE_INITIAL_RESPONSE='[{"version":"20260805090000","name":"add_least_privilege_gigl_tracking_worker"}]' \
  bash "$applier" >"$fixture_root/output.log"

grep -q \
  'Historical collision 20260805090000 is reconciled by repair migration 20260805090002_reapply_complete_merchant_invoice_partial_payment.sql' \
  "$fixture_root/output.log"
grep -q \
  'applied:         20260805090001  reapply_merchant_invoice_partial_review_contract' \
  "$fixture_root/output.log"
grep -q \
  'applied:         20260805090002  reapply_complete_merchant_invoice_partial_payment' \
  "$fixture_root/output.log"

if grep -q \
  "schema_migrations(version, name, statements).*20260805090000.*complete_merchant_invoice_partial_payments" \
  "$query_log"; then
  echo 'The occupied historical version must not be registered again' >&2
  exit 1
fi

first_repair_line="$(grep -n '20260805090001' "$query_log" | head -1 | cut -d: -f1)"
second_repair_line="$(grep -n '20260805090002' "$query_log" | head -1 | cut -d: -f1)"
if [ -z "$first_repair_line" ] || [ -z "$second_repair_line" ] || \
  [ "$first_repair_line" -ge "$second_repair_line" ]; then
  echo 'The split Paystack repair must be registered in dependency order' >&2
  exit 1
fi
