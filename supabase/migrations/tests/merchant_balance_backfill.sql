-- =============================================
-- REGRESSION TEST: legacy merchant balance backfill
--   Validates 20260430221100_backfill_merchant_balances.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_balance_backfill.sql
--
-- This script runs the backfill inside a transaction and rolls it back.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

CREATE TEMP TABLE merchant_balance_backfill_result ON COMMIT DROP AS
SELECT *
FROM public.backfill_merchant_balances();

DO $$
DECLARE
  function_count integer;
  mismatch_count integer;
BEGIN
  SELECT count(*)::integer INTO function_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n
    ON n.oid = p.pronamespace
  WHERE
    n.nspname = 'public'
    AND p.proname = 'backfill_merchant_balances'
    AND p.prosecdef = true
    AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path='];

  IF function_count <> 1 THEN
    RAISE EXCEPTION
      'backfill_merchant_balances must exist as SECURITY DEFINER with blank search_path';
  END IF;

  IF has_function_privilege('anon', 'public.backfill_merchant_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute public.backfill_merchant_balances()';
  END IF;

  IF has_function_privilege('authenticated', 'public.backfill_merchant_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute public.backfill_merchant_balances()';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.backfill_merchant_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute public.backfill_merchant_balances()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM merchant_balance_backfill_result result
    WHERE result.scope = 'merchant_balances'
  ) THEN
    RAISE EXCEPTION 'backfill result missing scope merchant_balances';
  END IF;

  WITH merchant_balance_rollup AS (
    SELECT
      mb.merchant_id,
      mb.currency,
      COALESCE(
        SUM(
          CASE
            WHEN t.status = 'completed' AND t.transaction_type = 'payment'
              THEN COALESCE(t.merchant_amount, t.amount - COALESCE(t.platform_fee, 0), 0)
            WHEN t.status = 'completed' AND t.transaction_type = 'payout'
              THEN -t.amount
            ELSE 0
          END
        ),
        0
      ) AS available_balance,
      COALESCE(
        SUM(
          CASE
            WHEN t.status IN ('pending', 'processing') AND t.transaction_type = 'payout'
              THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS pending_balance,
      COALESCE(
        SUM(
          CASE
            WHEN t.status = 'completed' AND t.transaction_type = 'payment'
              THEN COALESCE(t.merchant_amount, t.amount - COALESCE(t.platform_fee, 0), 0)
            ELSE 0
          END
        ),
        0
      ) AS total_earned,
      COALESCE(
        SUM(
          CASE
            WHEN t.status = 'completed' AND t.transaction_type = 'payout'
              THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS total_withdrawn
    FROM public.merchant_balances mb
    LEFT JOIN public.transactions t
      ON t.merchant_id = mb.merchant_id
      AND t.currency = mb.currency
      AND t.transaction_type IN ('payment', 'payout')
    GROUP BY mb.merchant_id, mb.currency
  )
  SELECT count(*)::integer INTO mismatch_count
  FROM public.merchant_balances mb
  JOIN merchant_balance_rollup mbr
    ON mbr.merchant_id = mb.merchant_id
    AND mbr.currency = mb.currency
  WHERE
    mb.available_balance IS DISTINCT FROM mbr.available_balance
    OR mb.pending_balance IS DISTINCT FROM mbr.pending_balance
    OR mb.total_earned IS DISTINCT FROM mbr.total_earned
    OR mb.total_withdrawn IS DISTINCT FROM mbr.total_withdrawn;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'merchant_balances aggregate mismatch count: %', mismatch_count;
  END IF;

  RAISE NOTICE 'OK: legacy merchant balance backfill validated';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
