#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-storefront-order-schema-${RANDOM}-$$"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_postgres() {
  for _ in $(seq 1 30); do
    logs="$(docker logs "$container" 2>&1 || true)"
    if grep -Fq 'PostgreSQL init process complete; ready for start up.' <<<"$logs" &&
      docker exec "$container" psql -X -qAt -U postgres -h 127.0.0.1 \
        -c 'SELECT 1' >/dev/null 2>&1; then
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
  < "$repo_root/supabase/tests/storefront_order_private_schema_boundary_fixture.sql"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/migrations/20260804120000_restore_storefront_order_private_schema_usage.sql"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/migrations/20260804130000_harden_storefront_order_private_schema_boundary.sql"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
  < "$repo_root/supabase/tests/storefront_order_private_schema_boundary_assertions.sql"

echo 'Storefront order private-schema boundary PostgreSQL test passed'
