-- Backfill wallet aggregate balances from their ledger tables.
--
-- The ledger rows are the source of truth. This migration recalculates stored
-- wallet totals and historical balance_after snapshots for customer and
-- merchant wallets so stale aggregate rows do not hide credited cashback or
-- merchant commissions.

CREATE OR REPLACE FUNCTION public.backfill_wallet_balances()
RETURNS TABLE(scope text, rows_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.backfill_wallet_balances', 0)
  );

  -- Keep the ledger snapshot consistent while aggregate balances are rebuilt.
  LOCK TABLE
    public.customer_wallet_transactions,
    public.customer_wallets,
    public.wallet_transactions,
    public.merchant_wallets,
    public.merchant_settlements
  IN SHARE ROW EXCLUSIVE MODE;

  WITH ordered_customer_transactions AS (
    SELECT
      cwt.id,
      SUM(
        CASE
          WHEN cwt.type IN ('cashback', 'bonus', 'adjustment') THEN cwt.amount
          WHEN cwt.type IN ('redemption', 'expiry') THEN -cwt.amount
          ELSE 0
        END
      ) OVER (
        PARTITION BY cwt.wallet_id
        ORDER BY cwt.created_at NULLS FIRST, cwt.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS computed_balance_after
    FROM public.customer_wallet_transactions cwt
    WHERE
      cwt.status = 'completed'
      OR (cwt.type = 'expiry' AND cwt.status = 'expired')
  ),
  updated_customer_transactions AS (
    UPDATE public.customer_wallet_transactions cwt
    SET balance_after = oct.computed_balance_after
    FROM ordered_customer_transactions oct
    WHERE
      cwt.id = oct.id
      AND cwt.balance_after IS DISTINCT FROM oct.computed_balance_after
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_rows
  FROM updated_customer_transactions;

  scope := 'customer_wallet_transactions.balance_after';
  rows_updated := v_rows;
  RETURN NEXT;

  WITH customer_rollup AS (
    SELECT
      cw.id AS wallet_id,
      COALESCE(
        SUM(
          CASE
            WHEN cwt.status = 'completed'
              AND cwt.type IN ('cashback', 'bonus', 'adjustment')
              THEN cwt.amount
            WHEN cwt.status = 'completed'
              AND cwt.type IN ('redemption', 'expiry')
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
              AND cwt.type IN ('cashback', 'bonus')
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
  ),
  updated_customer_wallets AS (
    UPDATE public.customer_wallets cw
    SET
      available_balance = cr.available_balance,
      total_earned = cr.total_earned,
      total_redeemed = cr.total_redeemed,
      updated_at = now()
    FROM customer_rollup cr
    WHERE
      cw.id = cr.wallet_id
      AND (
        cw.available_balance IS DISTINCT FROM cr.available_balance
        OR cw.total_earned IS DISTINCT FROM cr.total_earned
        OR cw.total_redeemed IS DISTINCT FROM cr.total_redeemed
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_rows
  FROM updated_customer_wallets;

  scope := 'customer_wallets';
  rows_updated := v_rows;
  RETURN NEXT;

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
      ) AS computed_balance_after
    FROM public.wallet_transactions wt
  ),
  updated_merchant_transactions AS (
    UPDATE public.wallet_transactions wt
    SET balance_after = omt.computed_balance_after
    FROM ordered_merchant_transactions omt
    WHERE
      wt.id = omt.id
      AND wt.balance_after IS DISTINCT FROM omt.computed_balance_after
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_rows
  FROM updated_merchant_transactions;

  scope := 'wallet_transactions.balance_after';
  rows_updated := v_rows;
  RETURN NEXT;

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
  ),
  merchant_rollup AS (
    SELECT
      mtr.wallet_id,
      mtr.available_balance,
      mtr.pending_balance,
      mtr.total_earned,
      mtr.total_withdrawn,
      COALESCE(sr.upcoming_balance, 0) AS upcoming_balance,
      COALESCE(sr.upcoming_count, 0) AS upcoming_count
    FROM merchant_transaction_rollup mtr
    LEFT JOIN settlement_rollup sr
      ON sr.wallet_id = mtr.wallet_id
  ),
  updated_merchant_wallets AS (
    UPDATE public.merchant_wallets mw
    SET
      available_balance = mr.available_balance,
      pending_balance = mr.pending_balance,
      total_earned = mr.total_earned,
      total_withdrawn = mr.total_withdrawn,
      upcoming_balance = mr.upcoming_balance,
      upcoming_count = mr.upcoming_count,
      updated_at = now()
    FROM merchant_rollup mr
    WHERE
      mw.id = mr.wallet_id
      AND (
        mw.available_balance IS DISTINCT FROM mr.available_balance
        OR mw.pending_balance IS DISTINCT FROM mr.pending_balance
        OR mw.total_earned IS DISTINCT FROM mr.total_earned
        OR mw.total_withdrawn IS DISTINCT FROM mr.total_withdrawn
        OR mw.upcoming_balance IS DISTINCT FROM mr.upcoming_balance
        OR mw.upcoming_count IS DISTINCT FROM mr.upcoming_count
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_rows
  FROM updated_merchant_wallets;

  scope := 'merchant_wallets';
  rows_updated := v_rows;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.backfill_wallet_balances() IS
  'Rebuilds customer and merchant wallet aggregate balances from ledger rows. SECURITY DEFINER with blank search_path; execution is restricted to service_role.';

REVOKE ALL ON FUNCTION public.backfill_wallet_balances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_wallet_balances() TO service_role;

SELECT * FROM public.backfill_wallet_balances();
