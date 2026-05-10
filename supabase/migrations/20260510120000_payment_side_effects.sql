-- Phase A — A1 migration (Δ-7, Δ-20, Δ-24, Δ-60, Δ-63, Δ-67, Δ-75)
--
-- Replaces the TOCTTOU-prone "check flag → run → set flag" pattern on
-- `orders.metadata` with a dedicated outbox ledger keyed (order_id, step).
-- Each side-effect step (paid_email, firs_invoice, loyalty_points,
-- ad_tracking_conversion, merchant_settlement) is claimed via INSERT…ON
-- CONFLICT DO UPDATE WHERE the existing row is failed OR a stale claim
-- (>60s old). The token-gated complete/fail UPDATE in the helper layer
-- ensures only the worker that won the claim can transition the row.
--
-- Δ-63: ships the table AND the `claim_payment_side_effect` RPC together
-- so the helper code introduced in this PR has the function at runtime.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------- Outbox table ----------
CREATE TABLE IF NOT EXISTS payment_side_effects (
  order_id        UUID NOT NULL REFERENCES orders(id)       ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  step            TEXT NOT NULL CHECK (step IN (
    'paid_email',
    'firs_invoice',
    'loyalty_points',
    'ad_tracking_conversion',
    'merchant_settlement'
  )),
  status          TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN (
    'claimed',
    'completed',
    'failed'
  )),
  claim_token     UUID NOT NULL DEFAULT gen_random_uuid(),
  claimed_by      TEXT NOT NULL,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  result          JSONB,
  error           TEXT,
  attempts        INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, step)
);

CREATE INDEX IF NOT EXISTS payment_side_effects_open_idx
  ON payment_side_effects (status, claimed_at)
  WHERE status != 'completed';

-- ---------- Δ-20 / Δ-75: RLS lockdown + explicit service_role policy ----------
ALTER TABLE payment_side_effects ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE payment_side_effects FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE payment_side_effects TO service_role;

-- Δ-75: explicit policy makes intent declarative and satisfies the project's
-- "always add RLS policies" rule. REVOKE/GRANT remain the primary lockdown;
-- this is layered defense.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'payment_side_effects'
       AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all
      ON public.payment_side_effects
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------- Δ-60 / Δ-63 / Δ-67: claim/takeover RPC ----------
CREATE OR REPLACE FUNCTION public.claim_payment_side_effect(
  p_order_id       uuid,
  p_transaction_id uuid,
  p_step           text,
  p_claim_token    uuid,
  p_claimed_by     text
) RETURNS TABLE (we_won boolean, current_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- Δ-67: defense-in-depth role guard. The function is GRANTed only to
-- service_role (REVOKE/GRANT below), but a SECURITY DEFINER function in
-- the public schema is an attractive surface — guard regardless so a
-- future grant slip-up doesn't escalate.
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_payment_side_effect requires service_role';
  END IF;

  -- Δ-24: takeover semantics. The conditional UPDATE in ON CONFLICT runs
  -- only when the existing row is `failed` or a stale claim (older than
  -- 60 seconds). New rows always win the claim outright. Two parallel
  -- workers observing the same stale row both INSERT, but the partial
  -- UPDATE picks exactly one — the loser sees a row whose claim_token
  -- is not theirs.
  INSERT INTO payment_side_effects
    (order_id, transaction_id, step, status, claim_token, claimed_by)
  VALUES
    (p_order_id, p_transaction_id, p_step, 'claimed', p_claim_token, p_claimed_by)
  ON CONFLICT (order_id, step) DO UPDATE
    SET claim_token = EXCLUDED.claim_token,
        claimed_by  = EXCLUDED.claimed_by,
        claimed_at  = now(),
        status      = 'claimed',
        attempts    = payment_side_effects.attempts + 1
    WHERE payment_side_effects.status = 'failed'
       OR (payment_side_effects.status = 'claimed'
           AND payment_side_effects.claimed_at < now() - interval '60 seconds');

  RETURN QUERY
  SELECT (pse.claim_token = p_claim_token) AS we_won,
         pse.status                        AS current_status
    FROM payment_side_effects pse
   WHERE pse.order_id = p_order_id
     AND pse.step     = p_step;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_payment_side_effect(
  uuid, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_payment_side_effect(
  uuid, uuid, text, uuid, text
) TO service_role;

COMMENT ON FUNCTION public.claim_payment_side_effect(
  uuid, uuid, text, uuid, text
) IS
  'Claims a payment_side_effects row for a single (order_id, step). Returns we_won=true to the worker whose claim_token is currently in the row; losers must short-circuit and let the winner run the side effect. Mark-completed/failed UPDATEs in the helper must filter by claim_token.';
