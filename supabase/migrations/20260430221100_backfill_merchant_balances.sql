-- Backfill legacy multi-currency merchant balances from transaction history.
--
-- `merchant_balances` predates the VTU `merchant_wallets` ledger. It is still
-- used by older payout flows, so it needs a separate transaction-history
-- rebuild instead of sharing the VTU wallet ledger calculation.

CREATE OR REPLACE FUNCTION public.backfill_merchant_balances()
RETURNS TABLE(scope text, rows_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.backfill_merchant_balances', 0)
  );

  LOCK TABLE
    public.transactions,
    public.merchant_balances
  IN SHARE ROW EXCLUSIVE MODE;

  WITH merchant_balance_targets AS (
    SELECT mb.merchant_id, mb.currency
    FROM public.merchant_balances mb
    UNION
    SELECT t.merchant_id, t.currency
    FROM public.transactions t
    WHERE t.transaction_type IN ('payment', 'payout')
  ),
  merchant_balance_rollup AS (
    SELECT
      mbt.merchant_id,
      mbt.currency,
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
    FROM merchant_balance_targets mbt
    LEFT JOIN public.transactions t
      ON t.merchant_id = mbt.merchant_id
      AND t.currency = mbt.currency
      AND t.transaction_type IN ('payment', 'payout')
    GROUP BY mbt.merchant_id, mbt.currency
  ),
  upserted_merchant_balances AS (
    INSERT INTO public.merchant_balances (
      merchant_id,
      currency,
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn,
      updated_at
    )
    SELECT
      mbr.merchant_id,
      mbr.currency,
      mbr.available_balance,
      mbr.pending_balance,
      mbr.total_earned,
      mbr.total_withdrawn,
      now()
    FROM merchant_balance_rollup mbr
    ON CONFLICT (merchant_id, currency)
    DO UPDATE SET
      available_balance = EXCLUDED.available_balance,
      pending_balance = EXCLUDED.pending_balance,
      total_earned = EXCLUDED.total_earned,
      total_withdrawn = EXCLUDED.total_withdrawn,
      updated_at = now()
    WHERE
      public.merchant_balances.available_balance IS DISTINCT FROM EXCLUDED.available_balance
      OR public.merchant_balances.pending_balance IS DISTINCT FROM EXCLUDED.pending_balance
      OR public.merchant_balances.total_earned IS DISTINCT FROM EXCLUDED.total_earned
      OR public.merchant_balances.total_withdrawn IS DISTINCT FROM EXCLUDED.total_withdrawn
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_rows
  FROM upserted_merchant_balances;

  scope := 'merchant_balances';
  rows_updated := v_rows;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.backfill_merchant_balances() IS
  'Rebuilds legacy merchant_balances from transaction history. SECURITY DEFINER with blank search_path; execution is restricted to service_role.';

REVOKE ALL ON FUNCTION public.backfill_merchant_balances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_merchant_balances() TO service_role;

SELECT * FROM public.backfill_merchant_balances();
