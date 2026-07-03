-- Push token deactivation auditing.
--
-- Send-time ticket processing and receipt polling now deactivate tokens that
-- Expo reports as permanently undeliverable (DeviceNotRegistered always;
-- InvalidCredentials only when isolated within a batch — e.g. tokens minted
-- under an Expo project / bundle-id pair the push service has no APNs
-- credentials for). Record WHY a token was deactivated so pruning decisions
-- are auditable and a bulk deactivation is diagnosable after the fact.

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

COMMENT ON COLUMN public.push_tokens.deactivation_reason IS
  'Why the token was deactivated: Expo ticket/receipt error code (DeviceNotRegistered, InvalidCredentials) or StaleLastUsed from the cleanup job. NULL while active.';

-- Re-claiming a token means the device proved it is alive and correctly
-- provisioned again: clear the deactivation audit fields alongside the
-- existing is_active = true re-activation. This replaces the CURRENT
-- 6-argument overload from 20260621120000_add_push_token_build_tracking.sql
-- (the 5-argument overload was dropped there; mobile apps call this one).
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token text,
  p_merchant_id uuid,
  p_platform text,
  p_device_name text DEFAULT NULL,
  p_app_type text DEFAULT 'storefront',
  p_build_number integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_token_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'register_push_token: authentication required'
      USING errcode = '42501';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) = 0
     OR p_merchant_id IS NULL
     OR p_platform IS NULL OR length(btrim(p_platform)) = 0 THEN
    RAISE EXCEPTION 'register_push_token: token, merchant_id and platform are required'
      USING errcode = '22023';
  END IF;

  INSERT INTO public.push_tokens AS pt (
    user_id, merchant_id, token, platform, device_name, app_type,
    build_number, is_active, last_used_at, updated_at
  )
  VALUES (
    v_uid, p_merchant_id, btrim(p_token), btrim(p_platform), p_device_name,
    coalesce(p_app_type, 'storefront'), p_build_number, true, now(), now()
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id             = v_uid,
    merchant_id         = excluded.merchant_id,
    platform            = excluded.platform,
    device_name         = excluded.device_name,
    app_type            = excluded.app_type,
    -- Keep a previously-known build number if a re-registration omits it.
    build_number        = coalesce(excluded.build_number, pt.build_number),
    is_active           = true,
    deactivation_reason = NULL,
    deactivated_at      = NULL,
    last_used_at        = now(),
    updated_at          = now()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) TO authenticated;

COMMENT ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) IS
  'Registers/re-claims a device push token for the authenticated caller and returns push_tokens.id. Captures the installed native build_number for update-nudge targeting. SECURITY DEFINER pins user_id to auth.uid() while letting the current device holder reclaim a token previously owned by another user. Re-claiming clears the deactivation audit fields.';

-- Stamp the same audit fields when the age-based cleanup deactivates tokens.
CREATE OR REPLACE FUNCTION public.cleanup_stale_push_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.push_tokens
  SET is_active = FALSE,
      deactivation_reason = 'StaleLastUsed',
      deactivated_at = now()
  WHERE is_active = TRUE
    AND last_used_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
