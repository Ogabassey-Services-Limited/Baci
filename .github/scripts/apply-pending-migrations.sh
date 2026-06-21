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

api_query_payload() {
  local body="$1" response
  # Capture the response so we can detect SQL errors. `api_query` (curl --fail)
  # already aborts on HTTP >= 400, but the Management API can also report a
  # failed statement with a 200 status and an error object in the body. The
  # /database/query endpoint returns a JSON array of rows on success and a JSON
  # object (with a `message`) on error, so treat anything that is not an array
  # as a failure. Without this, a migration whose SQL errors could still have
  # its schema_migrations row written and then be skipped on every future
  # deploy (recorded-but-not-applied drift).
  response="$(api_query <<<"$body")"
  if ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$response"; then
    echo "::error::Supabase query did not succeed; aborting before recording the migration." >&2
    printf 'Response: %s\n' "$response" | head -c 2000 >&2
    return 1
  fi
}

split_sql_statements() {
  node - "$1" <<'NODE'
const fs = require('node:fs');

const sql = fs.readFileSync(process.argv[2], 'utf8');
const statements = [];
let start = 0;
let i = 0;
let singleQuote = false;
let escapeStringQuote = false;
let doubleQuote = false;
let lineComment = false;
let blockCommentDepth = 0;
let dollarQuoteTag = null;

const isDollarTagCharacter = (char) => /[A-Za-z0-9_]/.test(char);
const isIdentifierCharacter = (char) => /[A-Za-z0-9_$]/.test(char);
const isEscapeStringPrefix = (quoteIndex) => {
  const previous = sql[quoteIndex - 1];
  if (previous !== 'E' && previous !== 'e') {
    return false;
  }

  const beforePrevious = sql[quoteIndex - 2];
  return !beforePrevious || !isIdentifierCharacter(beforePrevious);
};

while (i < sql.length) {
  const char = sql[i];
  const next = sql[i + 1];

  if (lineComment) {
    if (char === '\n') {
      lineComment = false;
    }
    i += 1;
    continue;
  }

  if (blockCommentDepth > 0) {
    if (char === '/' && next === '*') {
      blockCommentDepth += 1;
      i += 2;
      continue;
    }
    if (char === '*' && next === '/') {
      blockCommentDepth -= 1;
      i += 2;
      continue;
    }
    i += 1;
    continue;
  }

  if (dollarQuoteTag) {
    if (sql.startsWith(dollarQuoteTag, i)) {
      i += dollarQuoteTag.length;
      dollarQuoteTag = null;
      continue;
    }
    i += 1;
    continue;
  }

  if (singleQuote) {
    if (escapeStringQuote && char === '\\') {
      i += 2;
      continue;
    }
    if (char === "'" && next === "'") {
      i += 2;
      continue;
    }
    if (char === "'") {
      singleQuote = false;
      escapeStringQuote = false;
    }
    i += 1;
    continue;
  }

  if (doubleQuote) {
    if (char === '"' && next === '"') {
      i += 2;
      continue;
    }
    if (char === '"') {
      doubleQuote = false;
    }
    i += 1;
    continue;
  }

  if (char === '-' && next === '-') {
    lineComment = true;
    i += 2;
    continue;
  }

  if (char === '/' && next === '*') {
    blockCommentDepth = 1;
    i += 2;
    continue;
  }

  if (char === "'") {
    singleQuote = true;
    escapeStringQuote = isEscapeStringPrefix(i);
    i += 1;
    continue;
  }

  if (char === '"') {
    doubleQuote = true;
    i += 1;
    continue;
  }

  if (char === '$') {
    let end = i + 1;
    while (end < sql.length && isDollarTagCharacter(sql[end])) {
      end += 1;
    }
    if (sql[end] === '$') {
      dollarQuoteTag = sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }
  }

  if (char === ';') {
    const statement = sql.slice(start, i + 1).trim();
    if (statement.replace(/--.*$/gm, '').trim()) {
      statements.push(statement);
    }
    start = i + 1;
  }

  i += 1;
}

const trailing = sql.slice(start).trim();
if (trailing.replace(/--.*$/gm, '').trim()) {
  statements.push(trailing);
}

for (const statement of statements) {
  console.log(JSON.stringify(statement));
}
NODE
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

applied_versions_body="$(jq -n '{query: "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"}')"
applied_versions_response="$(api_query <<<"$applied_versions_body")"
applied_versions="$(jq -r '.[].version' <<<"$applied_versions_response")"

applied_count_remote=$(printf '%s' "$applied_versions" | grep -c . || true)
echo "Applied versions on remote: ${applied_count_remote}"

shopt -s nullglob
files=("$migrations_dir"/*.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files on disk — nothing to apply."
  exit 0
fi

mapfile -t sorted_files < <(printf '%s\n' "${files[@]}" | sort)

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
    applied_count=$((applied_count + 1))
    continue
  fi

  # Transactional migrations must not contain statements that cannot run inside
  # a BEGIN/COMMIT block. Those must opt out with the `-- disable-transaction`
  # first-line marker (handled above); otherwise the explicit transaction
  # wrapper below would fail.
  #
  # Strip SQL line comments (`-- ...`) before scanning so a keyword that appears
  # only inside an explanatory comment — e.g. a migration that notes it
  # deliberately avoids CONCURRENTLY — is not misread as an actual
  # non-transactional statement (that false positive blocked a deploy once).
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
  applied_count=$((applied_count + 1))
done

echo
echo "Migrations summary: ${applied_count} applied, ${skipped_count} skipped."
