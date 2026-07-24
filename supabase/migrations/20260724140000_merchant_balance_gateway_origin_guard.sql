-- Gateway-origin guard for merchant_balances (phantom-balance money-bug fix).
--
-- ROOT CAUSE: `update_merchant_balance()` credited `merchant_balances` for EVERY
-- completed `transaction_type='payment'` regardless of gateway. `merchant_balances`
-- is the withdrawable ledger read by the payout route, which disburses via Korapay
-- `sendPayout`. Direct-settle gateways (paystack, and the BNPL rails klump/
-- credit_direct/credpal) settle straight to the MERCHANT'S OWN account — Baci never
-- holds those funds — so crediting them created a phantom withdrawable balance that,
-- once the Korapay disbursement float is funded, would let Baci pay the merchant a
-- second time for money it does not custody.
--
-- FIX (fail-closed allowlist): only a Korapay-collected payment — the one rail whose
-- funds land in Baci's own Korapay account and can actually be disbursed by the
-- payout route — may create a withdrawable balance. Every other gateway is excluded:
--   * paystack / klump / credit_direct / credpal -> settle directly to the merchant.
--   * manual                                     -> no real gateway settlement.
--   * juicyway                                   -> custodied, but tracked in the
--     separate `merchant_wallets` ledger; not in the Korapay disbursement float.
-- Extend the allowlist ONLY after confirming the gateway funds the disbursable
-- Korapay float. NULL `merchant_amount` never credits (guards mis-recorded rows).
--
-- This migration ALSO reconciles existing rows: it replaces `backfill_merchant_balances`
-- with the same gateway-aware, custodied-only rule (and drops the legacy gross-`amount`
-- fallback that over-credited NULL-`merchant_amount` rows), then runs it so pre-existing
-- phantom balances (Paystack/BNPL/manual) are corrected in the same deploy — not left to
-- a manual rerun. Reconciliation is safe now: no payout has ever run and Korapay
-- collection is gated OFF, so no live balance is mid-withdrawal. The `payout` branch of
-- the trigger is unchanged.

CREATE OR REPLACE FUNCTION "public"."update_merchant_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.transaction_type = 'payment' THEN
            -- Fail-closed: only Korapay-custodied funds are withdrawable via the
            -- Korapay payout float. See migration header for the excluded gateways.
            IF NEW.gateway = 'korapay' AND NEW.merchant_amount IS NOT NULL THEN
                INSERT INTO merchant_balances (merchant_id, currency, available_balance, total_earned)
                VALUES (NEW.merchant_id, NEW.currency, NEW.merchant_amount, NEW.merchant_amount)
                ON CONFLICT (merchant_id, currency)
                DO UPDATE SET
                    available_balance = merchant_balances.available_balance + NEW.merchant_amount,
                    total_earned = merchant_balances.total_earned + NEW.merchant_amount,
                    updated_at = NOW();
            END IF;
        ELSIF NEW.transaction_type = 'payout' THEN
            UPDATE merchant_balances
            SET available_balance = available_balance - NEW.amount,
                total_withdrawn = total_withdrawn + NEW.amount,
                updated_at = NOW()
            WHERE merchant_id = NEW.merchant_id AND currency = NEW.currency;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Reconcile existing merchant_balances with the same custodied-only rule. This
-- replaces the legacy backfill (which summed EVERY gateway and fell back to gross
-- `amount` when merchant_amount was NULL) so pre-migration phantom rows are corrected
-- in this deploy. Only completed Korapay payments count toward available_balance /
-- total_earned; payouts are unchanged. CREATE OR REPLACE preserves the existing
-- REVOKE/GRANT (service_role-only) privileges.
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
            -- Only Korapay-custodied payments create a withdrawable balance.
            WHEN t.status = 'completed' AND t.transaction_type = 'payment'
                 AND t.gateway = 'korapay'
              THEN COALESCE(t.merchant_amount, 0)
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
                 AND t.gateway = 'korapay'
              THEN COALESCE(t.merchant_amount, 0)
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

-- Run the corrected reconciliation now (idempotent; recomputes from transactions).
SELECT * FROM public.backfill_merchant_balances();
