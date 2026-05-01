-- =============================================
-- REGRESSION TEST: wallet balance backfill
--   Validates 20260430221000_backfill_wallet_balances.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/wallet_balance_backfill.sql
--
-- This script runs the backfill inside a transaction and rolls it back. It is
-- intentionally mutating during the transaction so aggregate invariants can be
-- checked without persisting test-side effects.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

INSERT INTO public.merchants (id, email, business_name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'wallet-backfill-test@example.com',
  'Wallet Backfill Test',
  'wallet-backfill-test'
);

INSERT INTO public.customers (id, merchant_id, email, first_name)
VALUES (
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101',
  'wallet-backfill-customer@example.com',
  'Wallet'
);

INSERT INTO public.customer_wallets (
  id,
  customer_id,
  merchant_id,
  available_balance,
  total_earned,
  total_redeemed,
  created_at
)
VALUES (
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101',
  0,
  0,
  0,
  '2026-05-01 00:00:00+00'
);

INSERT INTO public.customer_wallet_transactions (
  id,
  wallet_id,
  customer_id,
  merchant_id,
  type,
  amount,
  balance_after,
  source_type,
  source_id,
  status,
  description,
  created_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000101',
    'refund',
    100,
    0,
    'wallet_backfill_test',
    '00000000-0000-4000-8000-000000000201',
    'completed',
    'Backfill refund fixture',
    '2026-05-01 00:01:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000101',
    'debit',
    25,
    0,
    'wallet_backfill_test',
    '00000000-0000-4000-8000-000000000202',
    'completed',
    'Backfill debit fixture',
    '2026-05-01 00:02:00+00'
  );

CREATE TEMP TABLE wallet_balance_backfill_result ON COMMIT DROP AS
SELECT *
FROM public.backfill_wallet_balances();

DO $$
DECLARE
  function_count integer;
  missing_scope text;
  mismatch_count integer;
BEGIN
  SELECT count(*)::integer INTO function_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n
    ON n.oid = p.pronamespace
  WHERE
    n.nspname = 'public'
    AND p.proname = 'backfill_wallet_balances'
    AND p.prosecdef = true
    AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path='];

  IF function_count <> 1 THEN
    RAISE EXCEPTION
      'backfill_wallet_balances must exist as SECURITY DEFINER with blank search_path';
  END IF;

  IF has_function_privilege('anon', 'public.backfill_wallet_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute public.backfill_wallet_balances()';
  END IF;

  IF has_function_privilege('authenticated', 'public.backfill_wallet_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute public.backfill_wallet_balances()';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.backfill_wallet_balances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute public.backfill_wallet_balances()';
  END IF;

  SELECT expected_scope INTO missing_scope
  FROM (
    VALUES
      ('customer_wallet_transactions.balance_after'),
      ('customer_wallets'),
      ('wallet_transactions.balance_after'),
      ('merchant_wallets')
  ) AS expected(expected_scope)
  WHERE NOT EXISTS (
    SELECT 1
    FROM wallet_balance_backfill_result result
    WHERE result.scope = expected.expected_scope
  )
  LIMIT 1;

  IF missing_scope IS NOT NULL THEN
    RAISE EXCEPTION 'backfill result missing scope %', missing_scope;
  END IF;

  WITH ordered_customer_transactions AS (
    SELECT
      cwt.id,
      SUM(
        CASE
          WHEN cwt.type IN ('credit', 'cashback', 'bonus', 'adjustment', 'refund') THEN cwt.amount
          WHEN cwt.type IN ('debit', 'redemption', 'expiry') THEN -cwt.amount
          ELSE 0
        END
      ) OVER (
        PARTITION BY cwt.wallet_id
        ORDER BY cwt.created_at NULLS FIRST, cwt.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS expected_balance_after
    FROM public.customer_wallet_transactions cwt
    WHERE
      cwt.status = 'completed'
      OR (cwt.type = 'expiry' AND cwt.status = 'expired')
  )
  SELECT count(*)::integer INTO mismatch_count
  FROM public.customer_wallet_transactions cwt
  JOIN ordered_customer_transactions oct
    ON oct.id = cwt.id
  WHERE cwt.balance_after IS DISTINCT FROM oct.expected_balance_after;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'customer_wallet_transactions.balance_after mismatch count: %',
      mismatch_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_wallet_transactions
    WHERE
      id = '00000000-0000-4000-8000-000000000104'
      AND balance_after = 100
  ) THEN
    RAISE EXCEPTION 'seeded refund transaction balance_after was not backfilled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_wallet_transactions
    WHERE
      id = '00000000-0000-4000-8000-000000000105'
      AND balance_after = 75
  ) THEN
    RAISE EXCEPTION 'seeded debit transaction balance_after was not backfilled';
  END IF;

  WITH customer_rollup AS (
    SELECT
      cw.id AS wallet_id,
      COALESCE(
        SUM(
          CASE
            WHEN cwt.status = 'completed'
              AND cwt.type IN ('credit', 'cashback', 'bonus', 'adjustment', 'refund')
              THEN cwt.amount
            WHEN cwt.status = 'completed'
              AND cwt.type IN ('debit', 'redemption', 'expiry')
              THEN -cwt.amount
            WHEN cwt.status = 'expired' AND cwt.type = 'expiry'
              THEN -cwt.amount
            ELSE 0
          END
        ),
        0
      ) AS available_balance,
      COALESCE(
        SUM(
          CASE
            WHEN cwt.status = 'completed'
              AND cwt.type IN ('credit', 'cashback', 'bonus')
              THEN cwt.amount
            ELSE 0
          END
        ),
        0
      ) AS total_earned,
      GREATEST(
        COALESCE(
          SUM(
            CASE
              WHEN cwt.status = 'completed' AND cwt.type = 'redemption'
                THEN cwt.amount
              WHEN cwt.status = 'completed'
                AND cwt.type = 'adjustment'
                AND cwt.source_type = 'order_reversal'
                THEN -cwt.amount
              ELSE 0
            END
          ),
          0
        ),
        0
      ) AS total_redeemed
    FROM public.customer_wallets cw
    LEFT JOIN public.customer_wallet_transactions cwt
      ON cwt.wallet_id = cw.id
    GROUP BY cw.id
  )
  SELECT count(*)::integer INTO mismatch_count
  FROM public.customer_wallets cw
  JOIN customer_rollup cr
    ON cr.wallet_id = cw.id
  WHERE
    cw.available_balance IS DISTINCT FROM cr.available_balance
    OR cw.total_earned IS DISTINCT FROM cr.total_earned
    OR cw.total_redeemed IS DISTINCT FROM cr.total_redeemed;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'customer_wallets aggregate mismatch count: %', mismatch_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_wallets
    WHERE
      id = '00000000-0000-4000-8000-000000000103'
      AND available_balance = 75
      AND total_earned = 0
      AND total_redeemed = 0
  ) THEN
    RAISE EXCEPTION 'seeded customer wallet aggregate was not backfilled';
  END IF;

  WITH ordered_merchant_transactions AS (
    SELECT
      wt.id,
      SUM(
        CASE
          WHEN wt.status = 'completed' AND wt.type IN ('credit', 'refund', 'adjustment')
            THEN wt.amount
          WHEN wt.status IN ('pending', 'processing', 'completed')
            AND wt.type IN ('debit', 'withdrawal', 'payout')
            THEN -wt.amount
          ELSE 0
        END
      ) OVER (
        PARTITION BY wt.wallet_id
        ORDER BY wt.created_at NULLS FIRST, wt.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS expected_balance_after
    FROM public.wallet_transactions wt
  )
  SELECT count(*)::integer INTO mismatch_count
  FROM public.wallet_transactions wt
  JOIN ordered_merchant_transactions omt
    ON omt.id = wt.id
  WHERE wt.balance_after IS DISTINCT FROM omt.expected_balance_after;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'wallet_transactions.balance_after mismatch count: %', mismatch_count;
  END IF;

  WITH merchant_transaction_rollup AS (
    SELECT
      mw.id AS wallet_id,
      COALESCE(
        SUM(
          CASE
            WHEN wt.status = 'completed'
              AND wt.type IN ('credit', 'refund', 'adjustment')
              THEN wt.amount
            WHEN wt.status IN ('pending', 'processing', 'completed')
              AND wt.type IN ('debit', 'withdrawal', 'payout')
              THEN -wt.amount
            ELSE 0
          END
        ),
        0
      ) AS available_balance,
      COALESCE(
        SUM(
          CASE
            WHEN wt.status IN ('pending', 'processing')
              AND wt.type IN ('debit', 'withdrawal', 'payout')
              THEN wt.amount
            ELSE 0
          END
        ),
        0
      ) AS pending_balance,
      COALESCE(
        SUM(
          CASE
            WHEN wt.status = 'completed' AND wt.type = 'credit'
              THEN wt.amount
            ELSE 0
          END
        ),
        0
      ) AS total_earned,
      COALESCE(
        SUM(
          CASE
            WHEN wt.status = 'completed'
              AND wt.type IN ('debit', 'withdrawal', 'payout')
              THEN wt.amount
            ELSE 0
          END
        ),
        0
      ) AS total_withdrawn
    FROM public.merchant_wallets mw
    LEFT JOIN public.wallet_transactions wt
      ON wt.wallet_id = mw.id
    GROUP BY mw.id
  ),
  settlement_rollup AS (
    SELECT
      ms.wallet_id,
      COALESCE(SUM(ms.net_amount), 0) AS upcoming_balance,
      count(*)::integer AS upcoming_count
    FROM public.merchant_settlements ms
    WHERE
      ms.wallet_id IS NOT NULL
      AND ms.status IN ('pending', 'processing')
    GROUP BY ms.wallet_id
  )
  SELECT count(*)::integer INTO mismatch_count
  FROM public.merchant_wallets mw
  JOIN merchant_transaction_rollup mtr
    ON mtr.wallet_id = mw.id
  LEFT JOIN settlement_rollup sr
    ON sr.wallet_id = mw.id
  WHERE
    mw.available_balance IS DISTINCT FROM mtr.available_balance
    OR mw.pending_balance IS DISTINCT FROM mtr.pending_balance
    OR mw.total_earned IS DISTINCT FROM mtr.total_earned
    OR mw.total_withdrawn IS DISTINCT FROM mtr.total_withdrawn
    OR mw.upcoming_balance IS DISTINCT FROM COALESCE(sr.upcoming_balance, 0)
    OR mw.upcoming_count IS DISTINCT FROM COALESCE(sr.upcoming_count, 0);

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'merchant_wallets aggregate mismatch count: %', mismatch_count;
  END IF;

  RAISE NOTICE 'OK: wallet backfill function and aggregate invariants validated';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
