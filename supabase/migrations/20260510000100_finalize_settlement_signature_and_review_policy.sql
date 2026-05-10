-- Phase A — A0 follow-up #1 (Δ-74, Δ-75)
--
-- Addresses two PR #1562 review findings:
--
--   Δ-74 (Codex bot, P1): the 10-arg `record_merchant_settlement` had
--     `p_metadata jsonb DEFAULT '{}'::jsonb`. With a 9-arg wrapper of the
--     same name coexisting (Path B expand-contract), a 9-named-argument
--     PostgREST call could match BOTH overloads, surfacing as PGRST203
--     ("Could not choose the best candidate function") or 42725. That
--     would defeat the zero-downtime guarantee.
--
--     Drop DEFAULTs from ALL trailing params on the 10-arg form so it
--     requires every argument to be passed explicitly. PostgreSQL syntax
--     rule (SQLSTATE 42P13): "input parameters after one with a default
--     value must also have defaults" — so removing the default on
--     p_metadata alone is illegal; we drop all four trailing defaults
--     together. Verified safe: all 4 production callers (webhook×2,
--     verify, juicyway) already pass all 10 args explicitly. The 9-arg
--     wrapper keeps its own DEFAULTs intact for backwards compat with
--     pre-deploy TS code on the previous Vercel revision.
--
--     Result: 9-named-arg PostgREST calls match ONLY the 9-arg wrapper
--     (unambiguous). 10-named-arg calls match ONLY the 10-arg form
--     (unambiguous). No PGRST203.
--
--   Δ-75 (review, P3): `reconciliation_review` was created with RLS
--     enabled but no policies — functionally default-deny, but the
--     project rule (CLAUDE.md) is "ALWAYS add RLS policies when creating
--     new database tables". Add an explicit `service_role_all` policy
--     so the intent is visible in the schema, while the existing REVOKE/
--     GRANT pattern continues to deny anon/authenticated.

-- ---------- Δ-74: drop DEFAULTs on the 10-arg p_metadata + trailing params ----------
-- PostgreSQL forbids removing parameter defaults via CREATE OR REPLACE
-- (SQLSTATE 42P13: "cannot remove parameter defaults from existing
-- function. Hint: Use DROP FUNCTION ... first."). DROP the 10-arg
-- signature, recreate without defaults. The 9-arg backwards-compat
-- wrapper is a different signature (length 9, no jsonb param) and is
-- NOT affected by this DROP — DROP FUNCTION targets exactly one
-- signature.
DROP FUNCTION IF EXISTS public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
);

CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
  p_merchant_id       uuid,
  p_source_type       text,
  p_source_id         uuid,
  p_gateway           text,
  p_gateway_reference text,
  p_gross_amount      numeric,
  p_gateway_fee       numeric,
  p_platform_fee      numeric,
  p_description       text,
  p_metadata          jsonb
  -- Δ-74: ALL trailing params required (no DEFAULTs) so PostgREST cannot
  -- ambiguously match a 9-named-arg call to this 10-arg form.
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet_id      UUID;
  v_net_amount     DECIMAL(12,2);
  v_expected_date  DATE;
  v_settlement_id  UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_merchant_settlement requires service_role';
  END IF;

  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;
  v_expected_date := calculate_settlement_date(p_gateway);

  INSERT INTO merchant_settlements (
    merchant_id, wallet_id, source_type, source_id, gateway,
    gateway_reference, gross_amount, gateway_fee, platform_fee, net_amount,
    payment_date, expected_settlement_date, description, status, metadata
  ) VALUES (
    p_merchant_id, v_wallet_id, p_source_type, p_source_id, p_gateway,
    p_gateway_reference, p_gross_amount, p_gateway_fee, p_platform_fee,
    v_net_amount, NOW(), v_expected_date,
    COALESCE(p_description, 'Payment received'),
    CASE WHEN p_gateway = 'korapay' THEN 'settled' ELSE 'pending' END,
    p_metadata
  )
  ON CONFLICT (source_type, source_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL AND status != 'cancelled'
    DO NOTHING
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_gateway != 'korapay' THEN
    UPDATE merchant_wallets
       SET upcoming_balance = upcoming_balance + v_net_amount,
           upcoming_count   = upcoming_count + 1,
           updated_at       = NOW()
     WHERE id = v_wallet_id;
  ELSE
    UPDATE merchant_wallets
       SET available_balance = available_balance + v_net_amount,
           total_earned      = total_earned + v_net_amount,
           updated_at        = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO wallet_transactions (
      wallet_id, merchant_id, type, amount, balance_after,
      source_type, source_id, description, status
    )
    SELECT
      v_wallet_id, p_merchant_id, 'credit', v_net_amount, mw.available_balance,
      p_source_type, p_source_id,
      COALESCE(p_description, 'Payment settled'), 'completed'
    FROM merchant_wallets mw WHERE mw.id = v_wallet_id;
  END IF;

  RETURN v_settlement_id;
END $$;

COMMENT ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) IS
  'Records a payment settlement; idempotent on (source_type, source_id, gateway_reference). Settlement key is the BAC-* (transactions.gateway_reference) per Δ-22; gateway-side numeric ref lives in metadata.<gateway>_reference only. Δ-74: p_metadata required (no DEFAULT) to avoid PostgREST overload ambiguity with the 9-arg backwards-compat wrapper.';

-- ---------- Δ-75: explicit service_role policy on reconciliation_review ----------
-- RLS was enabled with no policies (default-deny) in
-- 20260509110000_orders_tax_basis_gift_wrapping_and_reconciliation_review.sql.
-- Adding an explicit policy makes the intent declarative and satisfies
-- the project's "always add RLS policies" rule. REVOKE/GRANT remain the
-- primary lockdown; this policy is layered defense.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'reconciliation_review'
       AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all
      ON public.reconciliation_review
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
