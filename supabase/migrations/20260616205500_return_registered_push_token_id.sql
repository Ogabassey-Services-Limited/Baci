-- Preserve the push-token registration API response contract while keeping the
-- atomic SECURITY DEFINER re-claim path. The original RPC returned void; callers
-- of /api/push-tokens/register historically received token_id, so return the
-- inserted/updated push_tokens.id from the same UPSERT.

DROP FUNCTION IF EXISTS public.register_push_token(text, uuid, text, text, text);

CREATE FUNCTION public.register_push_token(
  p_token text,
  p_merchant_id uuid,
  p_platform text,
  p_device_name text DEFAULT NULL,
  p_app_type text DEFAULT 'storefront'
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
    is_active, last_used_at, updated_at
  )
  VALUES (
    v_uid, p_merchant_id, btrim(p_token), btrim(p_platform), p_device_name,
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
    updated_at   = now()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.register_push_token(text, uuid, text, text, text) IS
  'Registers/re-claims a device push token for the authenticated caller and returns the push_tokens.id. SECURITY DEFINER pins user_id to auth.uid() while allowing the current device holder to reclaim a token row previously owned by another user.';
