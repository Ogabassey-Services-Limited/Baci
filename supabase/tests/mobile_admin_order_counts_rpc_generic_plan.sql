-- Regression coverage for branch-selective generic order-count plans.

BEGIN;

SET LOCAL plan_cache_mode = force_generic_plan;
SET LOCAL enable_seqscan = off;

PREPARE mobile_admin_branch_count_plan(uuid, uuid) AS
SELECT COUNT(*)
FROM public.orders AS orders
WHERE orders.merchant_id = $1
  AND orders.branch_id = $2
  AND orders.payment_status NOT IN ('bnpl_pending', 'failed', 'expired')
  AND (
    orders.payment_status NOT IN ('pending', 'unpaid')
    OR orders.payment_method IS NULL
    OR orders.payment_method NOT IN (
      'paystack', 'korapay', 'bank_transfer', 'credit_direct',
      'credpal', 'klump', 'juicyway'
    )
  );

DO $generic_plan_regression$
DECLARE
  v_count bigint;
  v_generic_plans bigint;
  v_plan jsonb;
  v_has_branch_index_condition boolean;
BEGIN
  FOR v_iteration IN 1..5 LOOP
    EXECUTE $sql$
      EXECUTE mobile_admin_branch_count_plan(
        '8a0d0e12-0000-4000-8000-000000000101'::uuid,
        '8a0d0e12-0000-4000-8000-000000000201'::uuid
      )
    $sql$ INTO v_count;
  END LOOP;

  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'generic-plan probe unexpectedly matched % rows', v_count;
  END IF;

  SELECT prepared.generic_plans
  INTO v_generic_plans
  FROM pg_catalog.pg_prepared_statements AS prepared
  WHERE prepared.name = 'mobile_admin_branch_count_plan';

  IF COALESCE(v_generic_plans, 0) = 0 THEN
    RAISE EXCEPTION 'branch-count regression did not exercise a generic plan';
  END IF;

  EXECUTE $sql$
    EXPLAIN (FORMAT JSON)
    EXECUTE mobile_admin_branch_count_plan(
      '8a0d0e12-0000-4000-8000-000000000101'::uuid,
      '8a0d0e12-0000-4000-8000-000000000201'::uuid
    )
  $sql$ INTO v_plan;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_path_query(v_plan, '$.**."Index Cond"') AS condition
    WHERE condition #>> '{}' LIKE '%branch_id = $2%'
  ) INTO v_has_branch_index_condition;

  IF NOT v_has_branch_index_condition THEN
    RAISE EXCEPTION
      'generic branch-count plan lost branch_id as an index condition: %',
      v_plan;
  END IF;
END;
$generic_plan_regression$;

DEALLOCATE mobile_admin_branch_count_plan;

ROLLBACK;
