-- Merchant passkey recovery: backing tables for the recovery-code engine.
--
-- Scope: the three tables that back lib/auth/recovery-codes.ts +
-- recovery-code-redemption.ts. The recovery-session (Custom Access Token hook),
-- identity-verification (IDV), and audit tables are deferred to later
-- migrations because they depend on open spikes/decisions.
--
-- These tables are written and read SERVER-SIDE ONLY (service-role client,
-- which bypasses RLS). RLS is enabled with no permissive policy and grants are
-- revoked from anon/authenticated, so a leaked anon/auth JWT cannot read code
-- hashes or the readiness/attempt ledger directly.
--
-- Refs: NIST SP 800-63B-4 §5.1.2 (look-up secrets); docs/auth/passwordless-rollout-plan.md.

-- ---------------------------------------------------------------------------
-- Recovery codes ("look-up secrets"): HMAC-SHA-256 hashes, single-use.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_auth_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code_set_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Active (usable) codes = not used, not revoked. Backs listActiveCodes().
CREATE INDEX IF NOT EXISTS merchant_auth_recovery_codes_active_idx
  ON public.merchant_auth_recovery_codes (user_id, code_set_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS merchant_auth_recovery_codes_code_set_idx
  ON public.merchant_auth_recovery_codes (code_set_id);

-- Backs ON DELETE CASCADE from auth.users and all-rows lookups by user.
CREATE INDEX IF NOT EXISTS merchant_auth_recovery_codes_user_idx
  ON public.merchant_auth_recovery_codes (user_id);

-- ---------------------------------------------------------------------------
-- Readiness: cached passkey_ready inputs (recomputed from joined tables).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_auth_readiness (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  authenticator_count integer NOT NULL DEFAULT 0,
  acknowledged_code_set_id uuid,
  recovery_codes_acknowledged_at timestamptz,
  device_bound_verified_at timestamptz,
  passkey_ready_at timestamptz,
  password_demoted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Attempt ledger: lockout is computed per user / code-set / IP from here, so
-- wrong codes that match no row still count toward the throttle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_auth_recovery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ip_hash text,
  code_set_id uuid,
  succeeded boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_auth_recovery_attempts_user_time_idx
  ON public.merchant_auth_recovery_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS merchant_auth_recovery_attempts_ip_time_idx
  ON public.merchant_auth_recovery_attempts (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS merchant_auth_recovery_attempts_lockout_idx
  ON public.merchant_auth_recovery_attempts (user_id, code_set_id, ip_hash, created_at DESC)
  WHERE succeeded = false;

DROP FUNCTION IF EXISTS public.claim_merchant_auth_recovery_code(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.begin_merchant_auth_recovery_attempt(
  p_user_id uuid,
  p_code_set_id uuid,
  p_ip_hash text,
  p_cutoff timestamptz,
  p_max_failures integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failure_count integer;
  attempt_id uuid;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'begin_merchant_auth_recovery_attempt requires service_role'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize lockout accounting for this user / code-set / IP tuple. This
  -- prevents concurrent wrong-code bursts from all passing a stale
  -- count-before-insert check.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::text || ':' || p_code_set_id::text || ':' || COALESCE(p_ip_hash, ''),
      0
    )
  );

  SELECT COUNT(*)::integer
  INTO failure_count
  FROM public.merchant_auth_recovery_attempts
  WHERE user_id = p_user_id
    AND code_set_id = p_code_set_id
    AND ip_hash IS NOT DISTINCT FROM p_ip_hash
    AND succeeded = false
    AND created_at >= p_cutoff;

  IF failure_count >= p_max_failures THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.merchant_auth_recovery_attempts (
    user_id,
    ip_hash,
    code_set_id,
    succeeded
  )
  VALUES (
    p_user_id,
    p_ip_hash,
    p_code_set_id,
    false
  )
  RETURNING id INTO attempt_id;

  RETURN attempt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_merchant_auth_recovery_code(
  p_user_id uuid,
  p_attempt_id uuid,
  p_code_id uuid,
  p_code_set_id uuid,
  p_ip_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_count integer;
  attempt_count integer;
  claimed boolean;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'claim_merchant_auth_recovery_code requires service_role'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.merchant_auth_recovery_codes
  SET used_at = now()
  WHERE id = p_code_id
    AND user_id = p_user_id
    AND code_set_id = p_code_set_id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  claimed := claimed_count > 0;

  IF claimed THEN
    UPDATE public.merchant_auth_recovery_attempts
    SET succeeded = true
    WHERE id = p_attempt_id
      AND user_id = p_user_id
      AND code_set_id = p_code_set_id
      AND ip_hash IS NOT DISTINCT FROM p_ip_hash
      AND succeeded = false;

    GET DIAGNOSTICS attempt_count = ROW_COUNT;
    IF attempt_count <> 1 THEN
      RAISE EXCEPTION 'recovery_attempt_not_found'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_merchant_auth_recovery_attempt(uuid, uuid, text, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_merchant_auth_recovery_attempt(uuid, uuid, text, timestamptz, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_merchant_auth_recovery_code(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_merchant_auth_recovery_code(uuid, uuid, uuid, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: server-only. Enable RLS with no permissive policy (deny-all to
-- anon/authenticated) and revoke direct grants. The service-role client used by
-- the recovery flow bypasses RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_auth_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_auth_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_auth_recovery_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.merchant_auth_recovery_codes FROM anon, authenticated;
REVOKE ALL ON public.merchant_auth_readiness FROM anon, authenticated;
REVOKE ALL ON public.merchant_auth_recovery_attempts FROM anon, authenticated;
