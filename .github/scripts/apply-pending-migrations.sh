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
#   2. Skips the file if the version is already in
#      supabase_migrations.schema_migrations.
#   3. Otherwise sends a single Management API request that runs the
#      migration SQL AND registers a row in schema_migrations. The Management
#      API wraps each request in a transaction, so partial application is
#      impossible. The registered version matches the filename — no drift.
#
# `statements` in schema_migrations is left as ARRAY[]::text[]. The CLI's
# `migration list` only consults version + name; round-tripping the migration
# SQL into the statements column would require fragile escaping for any SQL
# containing `$$` or single quotes.

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

readonly API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
readonly AUTH_HEADER="Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"

migrations_dir="$(cd "$(dirname "$0")/../.." && pwd)/supabase/migrations"
if [ ! -d "$migrations_dir" ]; then
  echo "::error::supabase/migrations directory not found at $migrations_dir"
  exit 1
fi

api_query() {
  curl --fail --silent --show-error \
    -X POST \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    --data-binary @- \
    "$API"
}

applied_versions="$(jq -n '{query: "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"}' \
  | api_query \
  | jq -r '.[].version')"

applied_count_remote=$(printf '%s' "$applied_versions" | grep -c . || true)
echo "Applied versions on remote: ${applied_count_remote}"

shopt -s nullglob
files=("$migrations_dir"/*.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files on disk — nothing to apply."
  exit 0
fi

IFS=$'\n' sorted_files=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

applied_count=0
skipped_count=0

for file in "${sorted_files[@]}"; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"

  if printf '%s\n' "$applied_versions" | grep -qx "$version"; then
    echo "✓ already applied: $version  ${name}"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  echo "→ applying:        $version  ${name}"

  # The migration SQL goes in untouched (jq --rawfile reads it verbatim and
  # JSON-encodes for transport). The INSERT registers the same version+name
  # we parsed from the filename, so the row matches the file 1:1.
  #
  # Version and name must be SQL string literals (single-quoted), NOT JSON
  # double-quoted (which Postgres parses as identifiers — `"20260428000000"`
  # would error with `column "20260428000000" does not exist`). Wrap in
  # single quotes and double any embedded single quote per SQL spec.
  body="$(jq -n \
    --rawfile sql "$file" \
    --arg version "$version" \
    --arg name "$name" \
    '{
       query: (
         $sql
         + "\n"
         + "INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES ("
         + "'"'"'" + ($version | gsub("'"'"'"; "'"'"''"'"'")) + "'"'"', "
         + "'"'"'" + ($name | gsub("'"'"'"; "'"'"''"'"'")) + "'"'"', "
         + "ARRAY[]::text[]);"
       )
     }'
  )"

  printf '%s' "$body" | api_query > /dev/null
  echo "✓ applied:         $version  ${name}"
  applied_count=$((applied_count + 1))
done

echo
echo "Migrations summary: ${applied_count} applied, ${skipped_count} skipped."
