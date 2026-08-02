-- Sensitive merchant identity fields are public-facing and appear on receipts.
-- Require a live Auth session plus either AAL2 or a recent primary
-- authentication before they can change, block direct Data API writes, and
-- preserve a forensic before/after trail.

CREATE OR REPLACE FUNCTION public.require_recent_merchant_settings_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_jwt jsonb := (SELECT auth.jwt());
  v_session_id uuid;
  v_aal text;
  v_latest_auth_at timestamptz;
  v_has_verified_mfa boolean := false;
BEGIN
  IF COALESCE(v_jwt ->> 'role', '') = 'service_role' THEN
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'merchant_settings_authentication_required'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_session_id := NULLIF(v_jwt ->> 'session_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_session_id := NULL;
  END;

  IF v_session_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM auth.sessions AS s
     WHERE s.id = v_session_id
       AND s.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'merchant_settings_reauthentication_required'
      USING ERRCODE = '42501';
  END IF;

  v_aal := COALESCE(v_jwt ->> 'aal', 'aal1');

  SELECT EXISTS (
    SELECT 1
      FROM auth.mfa_factors AS factor
     WHERE factor.user_id = v_user_id
       AND factor.status::text = 'verified'
  )
  INTO v_has_verified_mfa;

  IF v_has_verified_mfa AND v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'merchant_settings_mfa_required'
      USING ERRCODE = '42501';
  END IF;

  IF v_aal = 'aal2' THEN
    RETURN;
  END IF;

  SELECT pg_catalog.to_timestamp(MAX((entry.value ->> 'timestamp')::bigint))
    INTO v_latest_auth_at
    FROM pg_catalog.jsonb_array_elements(
      COALESCE(v_jwt -> 'amr', '[]'::jsonb)
    ) AS entry(value)
   WHERE pg_catalog.jsonb_typeof(entry.value) = 'object'
     AND (entry.value ->> 'timestamp') ~ '^[0-9]+$';

  IF v_latest_auth_at IS NULL
    OR v_latest_auth_at < pg_catalog.now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'merchant_settings_reauthentication_required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER FUNCTION public.require_recent_merchant_settings_auth() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.require_recent_merchant_settings_auth()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_recent_merchant_settings_auth()
  TO service_role;

CREATE OR REPLACE FUNCTION public.guard_merchant_identity_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.support_email IS NOT DISTINCT FROM OLD.support_email
    AND NEW.phone IS NOT DISTINCT FROM OLD.phone
    AND NEW.support_phone IS NOT DISTINCT FROM OLD.support_phone
    AND NEW.social_media IS NOT DISTINCT FROM OLD.social_media THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.current_setting(
    'app.merchant_sensitive_update_authorized',
    true
  ) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'merchant_sensitive_update_not_authorized'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.guard_merchant_identity_updates() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_merchant_identity_updates()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_merchant_identity_updates ON public.merchants;
CREATE TRIGGER guard_merchant_identity_updates
BEFORE UPDATE OF support_email, phone, support_phone, social_media
ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.guard_merchant_identity_updates();
