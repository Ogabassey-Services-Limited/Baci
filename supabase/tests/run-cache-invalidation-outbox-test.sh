#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-cache-outbox-${RANDOM}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --name "$container" -e POSTGRES_PASSWORD=test -d postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/tests/cache_invalidation_outbox_fixture.sql"
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/migrations/20260727033000_cache_invalidation_outbox.sql"
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/migrations/20260727090000_harden_cache_invalidation_outbox.sql"
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/tests/cache_invalidation_outbox.sql"

echo 'Cache invalidation outbox SQL tests passed'
