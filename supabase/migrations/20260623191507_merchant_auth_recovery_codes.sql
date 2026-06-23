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
  ON public.merchant_auth_recovery_codes (user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS merchant_auth_recovery_codes_code_set_idx
  ON public.merchant_auth_recovery_codes (code_set_id);

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
