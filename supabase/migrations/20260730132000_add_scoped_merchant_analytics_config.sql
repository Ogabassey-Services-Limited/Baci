-- Caller-authorized analytics configuration projection for the mobile admin.
--
-- `get_user_merchant_context()` intentionally chooses one merchant for legacy
-- dashboard callers. It must not be used after a mobile merchant switch,
-- because its implicit selection can seed merchant B's cache with merchant A's
-- identifiers or owner-only API tokens. This accessor requires the active
-- merchant id, verifies that the authenticated caller can access that exact
-- merchant, and redacts credentials for staff members.

CREATE OR REPLACE FUNCTION public.get_merchant_analytics_config(
  p_merchant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean := false;
  v_result jsonb;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'authenticated'
    OR v_user_id IS NULL
    OR p_merchant_id IS NULL
    OR public.has_merchant_access(p_merchant_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT m.user_id = v_user_id
    INTO v_is_owner
  FROM public.merchants AS m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'merchant', pg_catalog.jsonb_build_object(
      'offline_conversions_enabled', m.offline_conversions_enabled,
      'facebook_pixel_id', m.facebook_pixel_id,
      'facebook_capi_token', CASE WHEN v_is_owner THEN m.facebook_capi_token END,
      'tiktok_pixel_id', m.tiktok_pixel_id,
      'tiktok_access_token', CASE WHEN v_is_owner THEN m.tiktok_access_token END,
      'google_analytics_id', m.google_analytics_id,
      'ga4_api_secret', CASE WHEN v_is_owner THEN m.ga4_api_secret END,
      'snapchat_pixel_id', m.snapchat_pixel_id,
      'snapchat_capi_token', CASE WHEN v_is_owner THEN m.snapchat_capi_token END
    ),
    'staffAccess', pg_catalog.jsonb_build_object(
      'isStaff', NOT v_is_owner,
      'isOwner', v_is_owner
    )
  )
    INTO v_result
  FROM public.merchants AS m
  WHERE m.id = p_merchant_id;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_merchant_analytics_config(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_merchant_analytics_config(uuid) IS
  'Returns the active merchant analytics projection for authenticated owners or active staff; API tokens are redacted unless the caller owns that exact merchant.';

REVOKE ALL ON FUNCTION public.get_merchant_analytics_config(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_analytics_config(uuid)
  TO authenticated;
