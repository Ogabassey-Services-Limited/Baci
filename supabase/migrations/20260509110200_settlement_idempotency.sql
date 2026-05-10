-- Phase A — A0 migration #3 (Δ-14, Δ-17, Δ-19, Δ-29, Δ-41, Δ-45, Δ-54, Δ-71, Δ-73)
--
-- Adds the `merchant_settlements` partial UNIQUE index keyed on existing
-- columns `(source_type, source_id, gateway_reference) WHERE
-- gateway_reference IS NOT NULL AND status != 'cancelled'` so retries
-- never double-credit, then DROP+CREATEs `record_merchant_settlement`
-- with a new `p_metadata jsonb` parameter and `ON CONFLICT DO NOTHING`
-- on the new index. Wallet/upcoming-balance/Korapay-instant-credit/
-- wallet_transactions writes are gated on `IF v_settlement_id IS NOT
-- NULL` so a duplicate suppressed INSERT never double-credits.
--
-- Δ-73 (Path B expand-contract): a backwards-compat wrapper at the OLD
-- 9-arg signature is created alongside the new 10-arg form, so
-- in-flight requests on the previous Vercel deployment keep working
-- during the rolling deploy. Both signatures coexist; pre-deploy
-- callers route through the 9-arg wrapper which forwards into the
-- 10-arg body with default empty metadata. A follow-up PR drops the
-- wrapper after all 4 callers (webhook×2, verify, juicyway) are
-- verified on the 10-arg form in production logs (~24h of traffic).
-- Goal: zero error window during deploy.
--
-- Δ-22 invariant (single source of truth): every Paystack-driven caller
-- passes `p_gateway_reference = transactions.gateway_reference` (i.e. our
-- `BAC-…`). Paystack's numeric reference goes in
-- `merchant_settlements.metadata.paystack_reference` only — it is NEVER
-- the unique key.
--
-- Δ-48 ordering: `20260509110100_settlement_check_constraints.sql` MUST
-- run before this migration; otherwise the `juicyway` and `domain_purchase`
-- callers will surface previously-silent CHECK failures as loud errors
-- when ON CONFLICT semantics tighten.

-- ---------- Δ-14 / Δ-54: pre-check + partial UNIQUE index ----------
-- Pre-check predicate matches the unique-index predicate so historical
-- cancelled-status duplicates the index intentionally allows don't block
-- the migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM merchant_settlements
     WHERE gateway_reference IS NOT NULL
       AND status != 'cancelled'
     GROUP BY source_type, source_id, gateway_reference
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'merchant_settlements has existing non-cancelled duplicates on (source_type, source_id, gateway_reference); clean up before adding unique index';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_settlements_unique_source
  ON merchant_settlements (source_type, source_id, gateway_reference)
  WHERE gateway_reference IS NOT NULL AND status != 'cancelled';

-- ---------- Δ-29 / Δ-41: DROP + CREATE record_merchant_settlement ----------
-- Adding `p_metadata` as a default param creates a Postgres overload — the
-- old non-idempotent 9-arg function would stay callable, defeating the
-- unique-index guard. DROP first, then CREATE OR REPLACE on the new
-- signature. All 4 TS callers update in the same PR.
DROP FUNCTION IF EXISTS public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text
);

CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
  p_merchant_id       uuid,
  p_source_type       text,
  p_source_id         uuid,
  p_gateway           text,
  p_gateway_reference text,
  p_gross_amount      numeric,
  p_gateway_fee       numeric DEFAULT 0,
  p_platform_fee      numeric DEFAULT 0,
  p_description       text    DEFAULT NULL,
  p_metadata          jsonb   DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- Δ-45 preserves every behavior from baseline.sql:5105-5206. Changes:
--   (1) Δ-71 service_role role guard at the top
--   (2) new `metadata` column on INSERT (Δ-29)
--   (3) ON CONFLICT DO NOTHING on the partial unique index (Δ-14)
--   (4) all wallet/transaction writes gated on `IF v_settlement_id IS NOT NULL`
DECLARE
  v_wallet_id      UUID;
  v_net_amount     DECIMAL(12,2);
  v_expected_date  DATE;
  v_settlement_id  UUID;
BEGIN
  -- Δ-71: defense-in-depth role guard. REVOKE/GRANT below restricts the
  -- function to service_role; this guard catches future grant slip-ups.
  -- This RPC writes wallet balances — the most financially sensitive
  -- privileged function in the codebase, so the role guard belongs here.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_merchant_settlement requires service_role';
  END IF;

  -- Get or create wallet (preserved)
  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

  -- Calculate net amount (preserved)
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;

  -- Calculate expected settlement date (preserved)
  v_expected_date := calculate_settlement_date(p_gateway);

  -- Create settlement record — INSERT is now idempotent on
  -- (source_type, source_id, gateway_reference) per Δ-14.
  INSERT INTO merchant_settlements (
    merchant_id,
    wallet_id,
    source_type,
    source_id,
    gateway,
    gateway_reference,
    gross_amount,
    gateway_fee,
    platform_fee,
    net_amount,
    payment_date,
    expected_settlement_date,
    description,
    status,
    metadata
  ) VALUES (
    p_merchant_id,
    v_wallet_id,
    p_source_type,
    p_source_id,
    p_gateway,
    p_gateway_reference,
    p_gross_amount,
    p_gateway_fee,
    p_platform_fee,
    v_net_amount,
    NOW(),
    v_expected_date,
    COALESCE(p_description, 'Payment received'),
    CASE
      WHEN p_gateway = 'korapay' THEN 'settled'
      ELSE 'pending'
    END,
    p_metadata
  )
  ON CONFLICT (source_type, source_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL AND status != 'cancelled'
    DO NOTHING
  RETURNING id INTO v_settlement_id;

  -- Δ-45: gate every wallet/transaction write on a fresh INSERT.
  -- If v_settlement_id IS NULL, this is a duplicate retry — return early.
  IF v_settlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Wallet balance updates (preserved, gated)
  IF p_gateway != 'korapay' THEN
    -- Non-instant settlements: bump upcoming balance only
    UPDATE merchant_wallets
       SET upcoming_balance = upcoming_balance + v_net_amount,
           upcoming_count   = upcoming_count + 1,
           updated_at       = NOW()
     WHERE id = v_wallet_id;
  ELSE
    -- Korapay instant credit: bump available balance + total_earned
    UPDATE merchant_wallets
       SET available_balance = available_balance + v_net_amount,
           total_earned      = total_earned + v_net_amount,
           updated_at        = NOW()
     WHERE id = v_wallet_id;

    -- Also write the wallet_transactions audit row (preserved)
    INSERT INTO wallet_transactions (
      wallet_id,
      merchant_id,
      type,
      amount,
      balance_after,
      source_type,
      source_id,
      description,
      status
    )
    SELECT
      v_wallet_id,
      p_merchant_id,
      'credit',
      v_net_amount,
      mw.available_balance,
      p_source_type,
      p_source_id,
      COALESCE(p_description, 'Payment settled'),
      'completed'
    FROM merchant_wallets mw
    WHERE mw.id = v_wallet_id;
  END IF;

  RETURN v_settlement_id;
END $$;

-- Δ-19 / Δ-41: re-apply REVOKE/GRANT on the NEW signature.
-- The prior REVOKE migration (20260428071421) named the old, now-dropped
-- signature, so the lockdown does not transfer automatically.
REVOKE EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) IS
  'Records a payment settlement; idempotent on (source_type, source_id, gateway_reference). Settlement key is the BAC-* (transactions.gateway_reference) per Δ-22; Paystack numeric ref lives in metadata.paystack_reference only.';

-- ---------- Δ-73: backwards-compat 9-arg wrapper (Path B expand-contract) ----------
-- During the Vercel rolling deploy, in-flight requests on the previous
-- code revision still call `record_merchant_settlement` with 9 args.
-- That signature was DROP'd above to force replacement of the old
-- non-idempotent body, so without this wrapper those calls would fail
-- with `function … does not exist` (PostgreSQL ERROR 42883) for the
-- duration of the build+rollout. The wrapper forwards into the new
-- 10-arg body with empty metadata, so settlement and wallet credits
-- still happen idempotently for in-flight requests. The role guard,
-- ON CONFLICT, and IF FOUND wallet credit live in the 10-arg body
-- (where this wrapper delegates to) — every behavior is preserved.
--
-- DROP THIS WRAPPER in a follow-up migration after the deploy is
-- verified (~24h of traffic, all 4 callers on the 10-arg form per
-- merchant_settlements.metadata being non-empty for new rows).
CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
  p_merchant_id       uuid,
  p_source_type       text,
  p_source_id         uuid,
  p_gateway           text,
  p_gateway_reference text,
  p_gross_amount      numeric,
  p_gateway_fee       numeric DEFAULT 0,
  p_platform_fee      numeric DEFAULT 0,
  p_description       text    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Forward into the 10-arg form. Role guard + idempotency + wallet
  -- credit gating all happen inside the wrapped function. PostgreSQL
  -- resolves this 10-positional-arg call to the 10-arg signature
  -- unambiguously (the 9-arg wrapper itself has 9 args).
  RETURN public.record_merchant_settlement(
    p_merchant_id,
    p_source_type,
    p_source_id,
    p_gateway,
    p_gateway_reference,
    p_gross_amount,
    p_gateway_fee,
    p_platform_fee,
    p_description,
    '{}'::jsonb
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text
) TO service_role;

COMMENT ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text
) IS
  'TEMPORARY 9-arg wrapper for the Vercel deploy window (Δ-73 Path B). Forwards into the 10-arg form with empty metadata. Drop in a follow-up migration once all 4 callers are verified on the 10-arg form in production.';
