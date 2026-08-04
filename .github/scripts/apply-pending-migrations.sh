#!/usr/bin/env bash
#
# Apply pending Supabase migrations to production via the Management API.
#
# Avoids `supabase db push`, which requires a database password. We only need:
#   - SUPABASE_ACCESS_TOKEN — personal/org access token (sbp_…)
#   - SUPABASE_PROJECT_REF  — project ref (e.g. aivqthbxdshhltbwipbr)
#
# For each .sql file in supabase/migrations/ in filename order, the script:
#   1. Extracts the version (timestamp prefix) and name from the filename.
#   2. Skips the file if the version+recorded name is already reconciled in
#      supabase_migrations.schema_migrations. Two known historical collisions
#      are accepted only when their later repair migration is present.
#   3. Otherwise sends a single Management API request that runs the
#      migration SQL AND registers a row in schema_migrations. Normal migrations
#      are wrapped in one explicit BEGIN/COMMIT transaction, so the SQL and its
#      history row are atomic: if any statement errors (e.g. a hot-table ALTER
#      that times out on its lock) the whole block rolls back and NO history row
#      is written, so the next deploy retries instead of skipping a migration
#      that was recorded but never applied. The response is also validated (a
#      non-array body = error) so a 200-with-error never counts as success.
#      Files that start with `-- disable-transaction` are intentionally split
#      into top-level statements first so operations like CREATE INDEX
#      CONCURRENTLY can run outside a transaction; their history row is written
#      only after every statement succeeds.
#
# `statements` remains ARRAY[]::text[] because the CLI only consults version/name;
# preserving SQL there would require fragile escaping of `$$` and single quotes.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="${MIGRATIONS_DIR:-$(cd "$script_dir/../.." && pwd)/supabase/migrations}"
if [ ! -d "$migrations_dir" ]; then
  echo "::error::supabase/migrations directory not found at $migrations_dir"
  exit 1
fi

bash "$script_dir/check-migration-versions.sh" "$migrations_dir"
. "$script_dir/historical-migration-repair-spec.sh"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

readonly API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
readonly AUTH_HEADER="Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"

api_query() {
  curl --fail-with-body --silent --show-error \
    -X POST \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    --data-binary @- \
    "$API"
}

api_query_payload() {
  local body="$1" response
  # Capture response for SQL errors; curl --fail-with-body preserves HTTP bodies.
  # The Management API can also report a failed statement with a 200 status and
  # an error object in the body. /database/query returns arrays on success and
  # objects on error, so treat anything that is not an array as a failure. Without
  # this, a migration whose SQL errors could still have its schema_migrations row
  # written and then be skipped on every future deploy (recorded-but-not-applied
  # drift).
  if ! response="$(api_query <<<"$body")" || \
    ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$response"; then
    echo "::error::Supabase query did not succeed; aborting before recording the migration." >&2
    printf 'Response: %s\n' "$response" | head -c 2000 >&2
    return 1
  fi
}

split_sql_statements() {
  node "$script_dir/split-sql-statements.mjs" "$1"
}

build_register_migration_query() {
  jq -nr \
    --arg version "$1" \
    --arg name "$2" \
    '"INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES ("
     + "'"'"'" + ($version | gsub("'"'"'"; "'"'"''"'"'")) + "'"'"', "
     + "'"'"'" + ($name | gsub("'"'"'"; "'"'"''"'"'")) + "'"'"', "
     + "ARRAY[]::text[]);"'
}

historical_collision_repair_spec() {
  case "$1:$2" in
    20260615120000:customer_order_cancellation)
      printf '%s\t%s\n' '20260616205500' 'return_registered_push_token_id'
      ;;
    20260713130000:add_storefront_paystack_subaccount_configured_rpc)
      printf '%s\t%s\n' '20260713140000' 'quiz_finalize_rank_winners_reapply'
      ;;
    *) return 1 ;;
  esac
}

historical_collision_version_is_known() {
  case "$1" in
    20260615120000 | 20260713130000) return 0 ;;
    *) return 1 ;;
  esac
}

historical_collision_name_is_valid() {
  case "$1:$2" in
    20260615120000:customer_order_cancellation | \
    20260615120000:register_push_token_rpc | \
    20260713130000:add_storefront_paystack_subaccount_configured_rpc | \
    20260713130000:quiz_finalize_rank_winners)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

historical_name_alias_is_valid() {
  case "$1:$2:$3" in
    20260604132853:fix_storefront_order_customer_returning_id_ambiguity:fix_create_storefront_order_customer_returning_id_ambiguity)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

applied_versions_body="$(jq -n '{query: "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"}')"
applied_versions_response="$(api_query <<<"$applied_versions_body")"
applied_migrations="$(jq -r '.[] | [.version, .name] | @tsv' <<<"$applied_versions_response")"

applied_count_remote=$(printf '%s' "$applied_migrations" | grep -c . || true)
echo "Applied versions on remote: ${applied_count_remote}"

shopt -s nullglob
files=("$migrations_dir"/*.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files on disk — nothing to apply."
  exit 0
fi

# Bash expands globs in lexical order, which is the migration timestamp order.
# Avoid mapfile so the deployment preflight is also testable with macOS Bash.
sorted_files=("${files[@]}")

applied_count=0
skipped_count=0

for file in "${sorted_files[@]}"; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"

  recorded_name="$(awk -F '\t' -v version="$version" '$1 == version { print $2; exit }' <<<"$applied_migrations")"
  if [ -n "$recorded_name" ]; then
    if historical_collision_version_is_known "$version"; then
      if ! historical_collision_name_is_valid "$version" "$recorded_name" || \
        ! historical_collision_name_is_valid "$version" "$name"; then
        echo "::error::Historical collision $version has an unexpected recorded/current name pair: $recorded_name / $name" >&2
        exit 1
      fi

      if ! repair_spec="$(historical_collision_repair_spec "$version" "$recorded_name")"; then
        echo "::error::Historical collision $version recorded '$recorded_name', whose missing sibling has no repair migration" >&2
        exit 1
      fi
      IFS=$'\t' read -r repair_version repair_name <<<"$repair_spec"

      repair_recorded_name="$(awk -F '\t' -v version="$repair_version" '$1 == version { print $2; exit }' <<<"$applied_migrations")"
      if [ -n "$repair_recorded_name" ]; then
        if [ "$repair_recorded_name" != "$repair_name" ]; then
          echo "::error::Repair migration $repair_version is recorded as '$repair_recorded_name', not '$repair_name'" >&2
          exit 1
        fi
      elif [ ! -f "$migrations_dir/${repair_version}_${repair_name}.sql" ]; then
        echo "::error::Historical collision $version requires repair migration ${repair_version}_${repair_name}.sql" >&2
        exit 1
      fi
      echo "::warning::Historical collision $version is reconciled by repair migration ${repair_version}_${repair_name}.sql (recorded name: $recorded_name)"
    elif [ "$recorded_name" != "$name" ]; then
      if historical_name_alias_is_valid "$version" "$recorded_name" "$name"; then
        echo "::warning::historical name alias $version is reconciled: $recorded_name -> $name"
      else
        echo "::error::Migration $version is recorded as '$recorded_name', not current file '$name'" >&2
        exit 1
      fi
    fi
    echo "✓ already applied: $version  ${name}"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  if repair_spec="$(historical_migration_repair_spec "$version" "$name")"; then
    IFS=$'\t' read -r repair_version repair_name expected_sha <<<"$repair_spec"
    repair_file="$migrations_dir/${repair_version}_${repair_name}.sql"
    actual_sha="$(sha256sum "$file" | awk '{print $1}')"
    if [ "$actual_sha" != "$expected_sha" ] || [ ! -f "$repair_file" ]; then
      echo "::error::Historical migration $version requires the pinned append-only repair ${repair_version}_${repair_name}.sql and original source checksum" >&2
      exit 1
    fi
    body="$(bash "$script_dir/build-historical-repair-payload.sh" "$repair_file" "$(build_register_migration_query "$version" "$name")" "$(build_register_migration_query "$repair_version" "$repair_name")")"
    api_query_payload "$body"
    echo "✓ applied:         $repair_version  $repair_name"
    echo "::warning::Historical migration $version is reconciled by append-only repair migration ${repair_version}_${repair_name}.sql"
    applied_migrations="${applied_migrations}${applied_migrations:+$'\n'}${version}"$'\t'"${name}"$'\n'"${repair_version}"$'\t'"${repair_name}"
    applied_count=$((applied_count + 1))
    continue
  fi

  echo "→ applying:        $version  ${name}"

  if head -n 1 "$file" | grep -qx -- '-- disable-transaction'; then
    echo "  non-transactional migration marker detected"

    # CREATE INDEX CONCURRENTLY fails inside a multi-statement transaction
    # payload. Keep these marker migrations idempotent; if a later statement
    # fails, the history row is not written and the next deploy can resume.
    statement_count=0
    while IFS= read -r statement_json; do
      statement_count=$((statement_count + 1))
      body="$(jq -n --argjson query "$statement_json" '{query: $query}')"
      api_query_payload "$body"
    done < <(split_sql_statements "$file")

    if [ "$statement_count" -eq 0 ]; then
      echo "::error::non-transactional migration $file did not contain executable SQL"
      exit 1
    fi

    body="$(jq -n \
      --arg query "$(build_register_migration_query "$version" "$name")" \
      '{query: $query}')"
    api_query_payload "$body"
    echo "✓ applied:         $version  ${name}"
    applied_migrations="${applied_migrations}${applied_migrations:+$'\n'}${version}"$'\t'"${name}"
    applied_count=$((applied_count + 1))
    continue
  fi

  # Strip comments before checking for statements that require the marker.
  if sed 's/--.*//' "$file" | grep -qiE '\bconcurrently\b|\bvacuum\b|create[[:space:]]+database|drop[[:space:]]+database|reindex'; then
    echo "::error::$file contains a non-transactional statement but is missing the '-- disable-transaction' first-line marker"
    exit 1
  fi

  # The migration SQL goes in untouched (jq --rawfile reads it verbatim and
  # JSON-encodes for transport). The INSERT registers the same version+name
  # we parsed from the filename, so the row matches the file 1:1.
  #
  # The SQL and the registration INSERT are wrapped in a single explicit
  # transaction so they are atomic: if any migration statement errors (e.g. a
  # hot-table ALTER that cannot acquire its lock), the whole block rolls back
  # and the schema_migrations row is never written — so the next deploy retries
  # instead of skipping a never-applied migration forever. `lock_timeout` keeps
  # a blocked DDL from queueing on a busy table; it fails fast and retries.
  #
  # Version and name must be SQL string literals (single-quoted), NOT JSON
  # double-quoted (which Postgres parses as identifiers — `"20260428000000"`
  # would error with `column "20260428000000" does not exist`). Wrap in
  # single quotes and double any embedded single quote per SQL spec.
  body="$(jq -n \
    --rawfile sql "$file" \
    --arg registration "$(build_register_migration_query "$version" "$name")" \
    --arg prefix "BEGIN;
SET LOCAL lock_timeout = '30s';
" \
    '{
       query: (
         $prefix
         + $sql
         + "\n"
         + $registration
         + "\nCOMMIT;"
       )
     }'
  )"

  api_query_payload "$body"
  echo "✓ applied:         $version  ${name}"
  applied_migrations="${applied_migrations}${applied_migrations:+$'\n'}${version}"$'\t'"${name}"
  applied_count=$((applied_count + 1))
done

echo
echo "Migrations summary: ${applied_count} applied, ${skipped_count} skipped."
