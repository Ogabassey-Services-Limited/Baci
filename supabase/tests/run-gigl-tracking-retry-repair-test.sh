#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-gigl-retry-repair-${RANDOM}-$$"
fixture_root="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$fixture_root"
}
trap cleanup EXIT

wait_for_postgres() {
  for _ in $(seq 1 30); do
    if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$container" >&2 || true
  return 1
}

mkdir -p "$fixture_root/bin" "$fixture_root/migrations"
docker run --name "$container" -e POSTGRES_PASSWORD=test -d postgres:17-alpine >/dev/null
wait_for_postgres

docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/tests/gigl_tracking_retry_repair_fixture.sql"
cp \
  "$repo_root/supabase/migrations/20260801141800_harden_gigl_tracking_retry_edges.sql" \
  "$fixture_root/migrations/20260801141800_harden_gigl_tracking_retry_edges.sql"
cp \
  "$repo_root/supabase/migrations/20260803000700_repair_gigl_tracking_retry_edges.sql" \
  "$fixture_root/migrations/20260803000700_repair_gigl_tracking_retry_edges.sql"

cat > "$fixture_root/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
query="$(jq -r '.query' <<<"$payload")"
if [[ "$query" == 'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version' ]]; then
  rows="$(docker exec "$MIGRATION_TEST_CONTAINER" psql -X -qAt -F $'\t' -U postgres -c "$query")"
  if [[ -n "$rows" ]]; then
    jq -Rn '[inputs | split("\t") | {version: .[0], name: .[1]}]' <<<"$rows"
  else
    printf '[]\n'
  fi
else
  docker exec "$MIGRATION_TEST_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -c "$query" >/dev/null
  printf '[]\n'
fi
FAKE_CURL
chmod +x "$fixture_root/bin/curl"

PATH="$fixture_root/bin:$PATH" \
  MIGRATION_TEST_CONTAINER="$container" \
  MIGRATIONS_DIR="$fixture_root/migrations" \
  SUPABASE_ACCESS_TOKEN=test \
  SUPABASE_PROJECT_REF=test \
  bash "$repo_root/.github/scripts/apply-pending-migrations.sh"

docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/tests/gigl_tracking_retry_repair.sql"

echo 'GIGL tracking retry repair PostgreSQL test passed'
