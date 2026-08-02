#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container="baci-cache-outbox-${RANDOM}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }

wait_for_postgres_final_readiness() {
  local target_container="$1"
  local max_attempts="${2:-30}"
  for _ in $(seq 1 "$max_attempts"); do
    if docker logs "$target_container" 2>&1 \
      | grep -Fq 'PostgreSQL init process complete; ready for start up.' \
      && docker exec "$target_container" pg_isready -U postgres \
        >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$target_container" >&2 || true
  return 1
}

main() {
  trap cleanup EXIT
  docker run --name "$container" -e POSTGRES_PASSWORD=test -d \
    postgres:17-alpine >/dev/null
  if ! wait_for_postgres_final_readiness "$container"; then
    echo 'PostgreSQL did not reach final readiness' >&2
    exit 1
  fi

  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_fixture.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727033000_cache_invalidation_outbox.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727090000_correct_cache_invalidation_outbox.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727105959_archive_cross_tenant_product_category_memberships.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_archive_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727110000_complete_cache_invalidation_trigger_coverage.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727150000_exact_product_and_feature_cache_invalidation.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727170000_fix_cache_invalidation_outbox_fairness.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727170936_add_product_offer_and_key_spec_cache_invalidation.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727184356_enforce_ordered_exact_cache_and_membership_ownership.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727185139_preserve_exact_product_identifier_case.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/migrations/20260727195209_allow_platform_admin_read_product_category_archive.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_review_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_corrective_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_exact_product_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round5_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round6_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round7_ordering_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round7_owner_guard_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round7_case_regressions.sql"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres \
    < "$repo_root/supabase/tests/cache_invalidation_outbox_round8_archive_policy_regressions.sql"

  echo 'Cache invalidation outbox SQL tests passed'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
