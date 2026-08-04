#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

fake_bin="$fixture_root/bin"
fixture_migrations="$fixture_root/migrations"
query_log="$fixture_root/queries.log"
output_log="$fixture_root/output.log"
mkdir -p "$fake_bin" "$fixture_migrations"

cat >"$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
printf '%s\n' "$payload" >>"$FAKE_QUERY_LOG"
if jq -e '.query | startswith("SELECT version, name")' >/dev/null <<<"$payload"; then
  printf '%s\n' "${FAKE_INITIAL_RESPONSE:-[]}"
else
  printf '%s\n' '[]'
fi
FAKE_CURL
chmod +x "$fake_bin/curl"

cp "$script_dir/../../supabase/migrations/20260801142000_harden_gigl_notification_recovery_edges.sql" \
  "$fixture_migrations/20260801142000_harden_gigl_notification_recovery_edges.sql"
cp "$script_dir/../../supabase/migrations/20260804000200_repair_gigl_notification_recovery_edges.sql" \
  "$fixture_migrations/20260804000200_repair_gigl_notification_recovery_edges.sql"
cp "$script_dir/../../supabase/migrations/20260804000400_repair_gigl_notification_terminality_cardinality.sql" \
  "$fixture_migrations/20260804000400_repair_gigl_notification_terminality_cardinality.sql"

PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$fixture_migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$query_log" \
  bash "$script_dir/apply-pending-migrations.sh" >"$output_log"

grep -q 'applied:         20260804000400  repair_gigl_notification_terminality_cardinality' "$output_log"
grep -q 'Superseded append-only repair 20260804000200 is skipped' "$output_log"
if grep -q '^→ applying:        20260804000200' "$output_log"; then
  echo 'The superseded repair must never be sent to the Management API' >&2
  exit 1
fi
grep -q ') <> pg_catalog.length(v_expected_monitor_terminality) THEN' "$query_log"
grep -q ') <> pg_catalog.length(v_expected_next_poll_terminality) THEN' "$query_log"
grep -q ') <> pg_catalog.length(v_expected_stopped_terminality) THEN' "$query_log"
if grep -q ') <> pg_catalog.length(v_expected_terminality) THEN' "$query_log"; then
  echo 'The malformed single-replacement guard must never reach the Management API' >&2
  exit 1
fi

pending_successor_log="$fixture_root/pending-successor-queries.log"
pending_successor_output="$fixture_root/pending-successor-output.log"
PATH="$fake_bin:$PATH" \
  MIGRATIONS_DIR="$fixture_migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  FAKE_QUERY_LOG="$pending_successor_log" \
  FAKE_INITIAL_RESPONSE='[{"version":"20260801142000","name":"harden_gigl_notification_recovery_edges"}]' \
  bash "$script_dir/apply-pending-migrations.sh" >"$pending_successor_output"

grep -q 'Superseded append-only repair 20260804000200 is skipped; 20260804000400_repair_gigl_notification_terminality_cardinality.sql will be applied later' "$pending_successor_output"
grep -q 'applied:         20260804000400  repair_gigl_notification_terminality_cardinality' "$pending_successor_output"
if grep -q '^→ applying:        20260804000200' "$pending_successor_output" || \
  grep -q ') <> pg_catalog.length(v_expected_terminality) THEN' "$pending_successor_log" || \
  ! grep -q ') <> pg_catalog.length(v_expected_monitor_terminality) THEN' "$pending_successor_log" || \
  ! grep -q ') <> pg_catalog.length(v_expected_next_poll_terminality) THEN' "$pending_successor_log" || \
  ! grep -q ') <> pg_catalog.length(v_expected_stopped_terminality) THEN' "$pending_successor_log"; then
  echo 'A recorded historical source must skip the malformed repair and apply its successor' >&2
  exit 1
fi

echo 'Historical migration repair supersession test passed'
