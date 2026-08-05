#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-gigl-monitor-backfill-${RANDOM}-$$"
fixture_root="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$fixture_root"
}
trap cleanup EXIT

wait_for_postgres() {
  for _ in $(seq 1 30); do
    if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$container" >&2 || true
  return 1
}

docker run --name "$container" -e POSTGRES_PASSWORD=test -d postgres:17-alpine >/dev/null
wait_for_postgres

docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/tests/gigl_monitor_backfill_repair_fixture.sql"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/migrations/20260804000500_repair_gigl_monitor_backfill_join.sql"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/tests/gigl_monitor_backfill_repair.sql"

echo 'GIGL monitor backfill repair PostgreSQL test passed'
