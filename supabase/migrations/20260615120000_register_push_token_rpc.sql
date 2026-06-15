-- Register (or re-claim) a device push token for the authenticated caller.
--
-- Why a SECURITY DEFINER RPC instead of a plain upsert:
-- Expo push tokens are device-unique (push_tokens.token has a UNIQUE index).
-- When a second account signs in on the SAME physical device, the client's
-- upsert (on conflict: token) becomes an UPDATE of a row still owned by the
-- previous user_id. The UPDATE RLS policy's USING clause
--   (auth.uid() = user_id OR user_id IS NULL OR is_active = false)
-- then blocks it with error 42501 ("violates row-level security policy
-- (USING expression)"). RLS policies cannot express "let the current device
-- holder claim a row owned by another user" safely, so — per Supabase
-- guidance for row-ownership transfer — we use a SECURITY DEFINER function
-- that performs the transfer and pins user_id to the authenticated caller.
-- A caller can therefore only ever claim a token to THEMSELVES.
--
-- SECURITY DEFINER hardening (Supabase best practice):
--   * SET search_path = '' and fully schema-qualify every reference.
--   * EXECUTE revoked from public/anon, granted only to authenticated.

CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token text,
  p_merchant_id uuid,
  p_platform text,
  p_device_name text DEFAULT NULL,
  p_app_type text DEFAULT 'storefront'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
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
    is_active, last_used_at, updated_at
  )
  VALUES (
    v_uid, p_merchant_id, btrim(p_token), p_platform, p_device_name,
    coalesce(p_app_type, 'storefront'), true, now(), now()
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id      = v_uid,
    merchant_id  = excluded.merchant_id,
    platform     = excluded.platform,
    device_name  = excluded.device_name,
    app_type     = excluded.app_type,
    is_active    = true,
    last_used_at = now(),
    updated_at   = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.register_push_token(text, uuid, text, text, text) IS
  'Registers/re-claims a device push token for the authenticated caller. SECURITY DEFINER so the current device holder can take over a token row previously owned by another user; user_id is always pinned to auth.uid().';
