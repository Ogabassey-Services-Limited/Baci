-- S2-P (part 1/2): guest-safe, single-use Credit-Direct checkout capability.
--
-- The guest sign route is deliberately unauthenticated (anon cookie client, no
-- auth.uid()), so an ownership check is infeasible. Minting is instead gated on
-- the order's unguessable tracking_token (the guest capability the shopper
-- already holds via their order link), so a caller who merely knows an order
-- UUID + customer email cannot forge a BNPL session. The server then issues an
-- unguessable, single-use capability token bound to {order, merchant,
-- server-derived amount, expiry, session}. Only the token hash is persisted; the
-- raw token is returned once to the caller and never stored or logged. The
-- companion migration 20260724100200 replaces set_credit_direct_session with a
-- token-consuming boundary that atomically marks the token used and mutates the
-- order — so a replayed or forged call cannot start/overwrite a BNPL session or
-- tamper the recorded amount.
--
-- The DB derives the payable amount from the LOCKED order row (never trusting a
-- caller-supplied amount), validates current payability + feature enablement,
-- and records replay-safe audit state.

-- ---------------------------------------------------------------------------
-- Capability-token store. RLS on + all role grants revoked: only the SECURITY
-- DEFINER RPCs below (owned by postgres) ever read or write it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_direct_checkout_tokens (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  signed_amount numeric NOT NULL CHECK (signed_amount > 0),
  session_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_direct_checkout_tokens_order_id_idx
  ON public.credit_direct_checkout_tokens (order_id);
CREATE INDEX IF NOT EXISTS credit_direct_checkout_tokens_merchant_id_idx
  ON public.credit_direct_checkout_tokens (merchant_id);
-- Supports bounded cleanup of expired / consumed rows.
CREATE INDEX IF NOT EXISTS credit_direct_checkout_tokens_expires_at_idx
  ON public.credit_direct_checkout_tokens (expires_at);

ALTER TABLE public.credit_direct_checkout_tokens ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: Supabase default privileges grant table DML to
-- anon/authenticated; strip them so the store is unreachable via PostgREST.
-- RLS is enabled with no policy, so even a stray grant would return zero rows.
REVOKE ALL ON TABLE public.credit_direct_checkout_tokens
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.credit_direct_checkout_tokens IS
  'Single-use Credit-Direct BNPL checkout capability tokens (S2-P). Only the '
  'SHA-256 hash is stored. Reachable exclusively through the SECURITY DEFINER '
  'issue/consume RPCs; RLS on and all role grants revoked.';

-- ---------------------------------------------------------------------------
-- Issue a capability token. Locks the order (bound to merchant + email +
-- unguessable tracking_token), derives the payable residual from the LOCKED
-- row, validates payability + feature enablement + eligible range, and stores
-- only the token hash. Returns the raw token once.
-- ---------------------------------------------------------------------------
-- Drop the earlier 4-arg signature before the arity change: CREATE OR REPLACE
-- cannot alter the argument list, it would leave the old overload behind.
DROP FUNCTION IF EXISTS public.issue_credit_direct_checkout_token(
  uuid, text, uuid, text
);
CREATE OR REPLACE FUNCTION public.issue_credit_direct_checkout_token(
  p_order_id uuid,
  p_email text,
  p_merchant_id uuid,
  p_session_id text,
  p_tracking_token text
) RETURNS TABLE(checkout_token text, signed_amount numeric, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric;
  v_amount_paid numeric;
  v_wallet_used numeric;
  v_shipping_status text;
  v_payment_status text;
  v_enabled boolean;
  v_min numeric;
  v_max numeric;
  v_amount numeric;
  v_token text;
  v_hash text;
  v_tracking_token text;
  v_expires timestamptz := pg_catalog.now() + interval '30 minutes';
BEGIN
  IF p_order_id IS NULL OR p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  p_email := NULLIF(pg_catalog.btrim(COALESCE(p_email, '')), '');
  IF p_email IS NULL OR pg_catalog.length(p_email) > 254 THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  p_session_id := NULLIF(pg_catalog.btrim(COALESCE(p_session_id, '')), '');
  IF p_session_id IS NULL OR pg_catalog.length(p_session_id) > 200 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  -- The order's unguessable tracking_token is the guest capability (same
  -- secret-bearer pattern as get_order_tracking / S0-B). Requiring it here is
  -- what confines minting to a caller who legitimately holds the order link:
  -- an anon PostgREST caller who merely knows an order UUID + customer email
  -- cannot forge a session without it. Fail closed if absent.
  v_tracking_token := NULLIF(pg_catalog.btrim(COALESCE(p_tracking_token, '')), '');
  IF v_tracking_token IS NULL OR pg_catalog.length(v_tracking_token) > 200 THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  -- Lock the order and bind it to the caller's merchant + email + tracking
  -- token. A guest can only reach an order it can name AND whose customer email
  -- AND unguessable tracking token it holds.
  SELECT o.total, o.amount_paid, o.wallet_amount_used,
         o.shipping_status, o.payment_status
    INTO v_total, v_amount_paid, v_wallet_used,
         v_shipping_status, v_payment_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
    AND pg_catalog.lower(o.customer_email) = pg_catalog.lower(p_email)
    AND o.tracking_token = v_tracking_token
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  -- Feature must be enabled for this merchant (fail closed while S2-I keeps
  -- Credit Direct disabled; re-enable is a separate flag flip).
  SELECT s.credit_direct_enabled,
         COALESCE(s.credit_direct_min_amount, 10000),
         COALESCE(s.credit_direct_max_amount, 5000000)
    INTO v_enabled, v_min, v_max
  FROM public.merchant_feature_settings AS s
  WHERE s.merchant_id = p_merchant_id
  LIMIT 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RAISE EXCEPTION 'credit_direct_disabled';
  END IF;

  -- Payability: never originate a BNPL loan for a cancelled or already-settled
  -- order. bnpl_pending is a legitimate retry source.
  IF v_shipping_status = 'cancelled' THEN
    RAISE EXCEPTION 'order_not_payable';
  END IF;
  IF v_payment_status IS NULL
     OR v_payment_status NOT IN ('unpaid', 'pending', 'partially_paid', 'bnpl_pending') THEN
    RAISE EXCEPTION 'order_not_payable';
  END IF;

  -- Server-derived residual from the locked row. Wallet / deposit redemptions
  -- settle before the gateway leg, so Credit Direct collects the remainder.
  v_amount := pg_catalog.round(
    COALESCE(v_total, 0)
      - GREATEST(COALESCE(v_amount_paid, 0), COALESCE(v_wallet_used, 0)),
    2
  );
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_order_amount';
  END IF;
  IF v_amount < v_min OR v_amount > v_max THEN
    RAISE EXCEPTION 'amount_out_of_range';
  END IF;

  -- Bound per-order issuance: a fresh sign attempt supersedes any earlier
  -- unconsumed token for this order (the shopper is retrying, with a new
  -- session), so drop those before inserting. This caps LIVE (unconsumed)
  -- tokens per order to one, so a single (leaked) tracking-token capability
  -- cannot spam unconsumed rows faster than the hourly consumed/expired sweep
  -- reclaims them. Mass row creation would then require mass order creation
  -- (each order needs its own real tracking token), which the checkout flow
  -- already bounds.
  DELETE FROM public.credit_direct_checkout_tokens
  WHERE order_id = p_order_id
    AND consumed_at IS NULL;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.credit_direct_checkout_tokens (
    token_hash, order_id, merchant_id, signed_amount, session_id, expires_at
  ) VALUES (
    v_hash, p_order_id, p_merchant_id, v_amount, p_session_id, v_expires
  );

  checkout_token := v_token;
  signed_amount := v_amount;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.issue_credit_direct_checkout_token(uuid, text, uuid, text, text)
  OWNER TO postgres;

-- Supabase default-grants EXECUTE to PUBLIC (and anon) on new functions, so a
-- bare REVOKE FROM PUBLIC is not enough. Revoke explicitly, then re-grant only
-- the roles the guest sign route runs as.
REVOKE EXECUTE ON FUNCTION
  public.issue_credit_direct_checkout_token(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.issue_credit_direct_checkout_token(uuid, text, uuid, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION
  public.issue_credit_direct_checkout_token(uuid, text, uuid, text, text) IS
  'S2-P: issues a single-use Credit-Direct checkout capability token bound to '
  '{order, merchant, server-derived amount, 30-min expiry, session}. Returns '
  'the raw token once; only its SHA-256 hash is persisted.';

-- ---------------------------------------------------------------------------
-- Bounded retention. Every checkout attempt inserts a row; consumed and
-- expired rows are dead weight the expires_at index exists to sweep. Delete in
-- capped batches so a scheduled caller (VPS cron via a service-role edge) can
-- reclaim rows without a long lock. Service-role only — never anon/authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_credit_direct_checkout_tokens(
  p_limit integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH doomed AS (
    SELECT id
    FROM public.credit_direct_checkout_tokens
    WHERE consumed_at IS NOT NULL
       OR expires_at <= pg_catalog.now()
    ORDER BY expires_at
    LIMIT GREATEST(COALESCE(p_limit, 1000), 1)
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.credit_direct_checkout_tokens t
  USING doomed
  WHERE t.id = doomed.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER FUNCTION public.cleanup_credit_direct_checkout_tokens(integer)
  OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.cleanup_credit_direct_checkout_tokens(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_credit_direct_checkout_tokens(integer)
  TO service_role;

COMMENT ON FUNCTION public.cleanup_credit_direct_checkout_tokens(integer) IS
  'S2-P retention: deletes up to p_limit consumed or expired checkout tokens '
  '(FOR UPDATE SKIP LOCKED). Service-role only, run by the pg_cron schedule below.';

-- ---------------------------------------------------------------------------
-- Schedule the retention sweep via pg_cron (already installed — the Supabase
-- retention cleanup manages cron.job_run_details). Hourly at :23 (off-peak
-- minute). Idempotent: guarded on the cron schema existing (a no-op in any
-- environment without pg_cron, e.g. a from-scratch replay), and re-runnable
-- (unschedule the prior job of the same name first). Without this the token
-- table would grow unbounded once Credit Direct is re-enabled.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'cron'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'credit-direct-checkout-token-cleanup'
    ) THEN
      PERFORM cron.unschedule('credit-direct-checkout-token-cleanup');
    END IF;
    PERFORM cron.schedule(
      'credit-direct-checkout-token-cleanup',
      '23 * * * *',
      $cron$SELECT public.cleanup_credit_direct_checkout_tokens(1000)$cron$
    );
  END IF;
END $$;
