-- Supabase hosted Postgres can reject ALTER DATABASE SET for custom GUCs
-- issued through managed SQL channels. Keep the documented GUC path, but add a
-- private table fallback so quiz route proofs can still be configured without
-- putting the HMAC secret in source-controlled migrations.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.quiz_rpc_server_secrets (
  secret_name text PRIMARY KEY,
  secret text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(secret)) >= 32),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (secret_name IN ('current', 'previous'))
);

ALTER TABLE private.quiz_rpc_server_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.quiz_rpc_server_secrets FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.quiz_rpc_server_secrets IS
  'Private fallback storage for quiz RPC proof HMAC secrets when custom database GUCs are unavailable.';

CREATE OR REPLACE FUNCTION public.quiz_route_proof_valid(
  p_route_proof jsonb,
  p_expected_action text DEFAULT NULL,
  p_expected_subject_id text DEFAULT NULL,
  p_expected_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text := COALESCE(p_route_proof->>'action', '');
  v_canonical text;
  v_current_secret text;
  v_expected_signature text;
  v_issued_at text := COALESCE(p_route_proof->>'issued_at', '');
  v_issued_at_at timestamptz;
  v_payload_hash text := COALESCE(p_route_proof->>'payload_hash', '');
  v_previous_expires_at timestamptz;
  v_previous_secret text;
  v_scope text := COALESCE(p_route_proof->>'scope', '');
  v_signature text := COALESCE(p_route_proof->>'signature', '');
  v_subject_id text := COALESCE(p_route_proof->>'subject_id', '');
  v_user_id text := COALESCE(p_route_proof->>'user_id', '');
  v_version text := COALESCE(p_route_proof->>'version', '');
BEGIN
  IF v_version <> 'quiz-rpc-proof:v1'
     OR v_scope <> 'quiz_phase1a'
     OR v_action = ''
     OR v_subject_id = ''
     OR v_user_id = ''
     OR v_issued_at = ''
     OR v_payload_hash !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_route_proof->>'proof_id', '') = ''
     OR v_signature !~ '^[0-9a-f]{64}$' THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'invalid_metadata');
  END IF;

  BEGIN
    v_issued_at_at := v_issued_at::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'invalid_issued_at');
  END;

  -- Allow only a small future skew for serverless clock drift.
  IF v_issued_at_at < pg_catalog.now() - INTERVAL '5 minutes'
     OR v_issued_at_at > pg_catalog.now() + INTERVAL '30 seconds' THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'issued_at_out_of_window');
  END IF;

  IF p_expected_action IS NOT NULL AND v_action <> p_expected_action THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'action_mismatch');
  END IF;

  IF p_expected_subject_id IS NOT NULL AND v_subject_id <> p_expected_subject_id THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'subject_mismatch');
  END IF;

  IF p_expected_user_id IS NOT NULL AND v_user_id <> p_expected_user_id::text THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'user_mismatch');
  END IF;

  v_current_secret := NULLIF(current_setting('app.quiz_rpc_server_secret_current', true), '');
  IF v_current_secret IS NULL THEN
    SELECT NULLIF(secret, '')
    INTO v_current_secret
    FROM private.quiz_rpc_server_secrets
    WHERE secret_name = 'current'
      AND (expires_at IS NULL OR expires_at > pg_catalog.now())
    LIMIT 1;
  END IF;

  v_previous_secret := NULLIF(current_setting('app.quiz_rpc_server_secret_previous', true), '');
  IF v_previous_secret IS NULL THEN
    SELECT NULLIF(secret, ''), expires_at
    INTO v_previous_secret, v_previous_expires_at
    FROM private.quiz_rpc_server_secrets
    WHERE secret_name = 'previous'
      AND expires_at > pg_catalog.now()
    LIMIT 1;
  ELSE
    BEGIN
      v_previous_expires_at := NULLIF(current_setting('app.quiz_rpc_server_secret_previous_expires_at', true), '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_previous_expires_at := NULL;
    END;
  END IF;

  v_canonical := v_version || E'\n' || v_scope || E'\n' || v_action || E'\n' || v_subject_id || E'\n' || v_user_id || E'\n' || v_issued_at || E'\n' || v_payload_hash;

  IF v_current_secret IS NOT NULL THEN
    v_expected_signature := pg_catalog.encode(extensions.hmac(v_canonical, v_current_secret, 'sha256'), 'hex');
    IF public.quiz_compare_signatures(v_signature, v_expected_signature) THEN
      RETURN true;
    END IF;
  END IF;

  IF v_previous_secret IS NOT NULL AND v_previous_expires_at IS NOT NULL AND v_previous_expires_at > pg_catalog.now() THEN
    v_expected_signature := pg_catalog.encode(extensions.hmac(v_canonical, v_previous_secret, 'sha256'), 'hex');
    IF public.quiz_compare_signatures(v_signature, v_expected_signature) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN public.quiz_log_route_proof_failure(p_route_proof, 'signature_mismatch');
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_rpc_server_secret_configured()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.quiz_rpc_server_secret_current', true), '') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM private.quiz_rpc_server_secrets
      WHERE secret_name = 'current'
        AND NULLIF(secret, '') IS NOT NULL
        AND (expires_at IS NULL OR expires_at > pg_catalog.now())
    );
$$;
