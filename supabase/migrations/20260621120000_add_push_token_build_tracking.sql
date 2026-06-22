-- Track the installed native build per push token so the in-app
-- "update available" push can target only users on an older build than the
-- latest published one, and throttle how often each device is nudged.
--
-- build_number stays NULL for tokens registered by app versions that predate
-- this change; the update-nudge job treats NULL as "outdated" so existing
-- installs are still reached, and self-corrects once the device re-registers
-- with its real build number.

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS build_number integer,
  ADD COLUMN IF NOT EXISTS last_update_push_at timestamptz;

-- Partial index for the daily nudge scan: active storefront tokens, filtered
-- by platform + build_number.
CREATE INDEX IF NOT EXISTS idx_push_tokens_update_nudge
  ON public.push_tokens (platform, build_number)
  WHERE is_active AND app_type = 'storefront';

-- Supersede register_push_token to capture the installed build number.
-- Append-only: drop the 5-arg version and recreate with the added parameter.
-- supabase.rpc() callers use named params, so existing callers that omit
-- p_build_number resolve to this function via its DEFAULT.
DROP FUNCTION IF EXISTS public.register_push_token(text, uuid, text, text, text);

CREATE FUNCTION public.register_push_token(
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
    user_id      = v_uid,
    merchant_id  = excluded.merchant_id,
    platform     = excluded.platform,
    device_name  = excluded.device_name,
    app_type     = excluded.app_type,
    -- Keep a previously-known build number if a re-registration omits it.
    build_number = coalesce(excluded.build_number, pt.build_number),
    is_active    = true,
    last_used_at = now(),
    updated_at   = now()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) TO authenticated;

COMMENT ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer) IS
  'Registers/re-claims a device push token for the authenticated caller and returns push_tokens.id. Captures the installed native build_number for update-nudge targeting. SECURITY DEFINER pins user_id to auth.uid() while letting the current device holder reclaim a token previously owned by another user.';
