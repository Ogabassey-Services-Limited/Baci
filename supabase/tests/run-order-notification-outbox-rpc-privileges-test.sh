#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-order-outbox-rpc-privileges-${RANDOM}-$$"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_postgres() {
  for _ in $(seq 1 30); do
    if docker exec "$container" psql -X -qAt -U postgres -h 127.0.0.1 \
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

for sql_file in \
  supabase/tests/order_notification_outbox_rpc_privileges_fixture.sql \
  supabase/migrations/20260724153014_revoke_order_notification_outbox_claim_public_grants.sql \
  supabase/tests/order_notification_outbox_rpc_privileges.sql; do
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 \
    < "$repo_root/$sql_file"
done

echo 'Order notification outbox RPC privilege PostgreSQL test passed'
