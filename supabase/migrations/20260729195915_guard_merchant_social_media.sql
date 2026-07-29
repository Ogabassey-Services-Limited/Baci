-- Guard the mature social-link update RPC with the same session boundary
-- and preserve before/after evidence in the canonical audit log.

-- Preserve the mature validation/merge implementation as an internal helper,
-- then put the existing public signature behind the new session gate.
ALTER FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb)
  RENAME TO update_merchant_social_media_internal;
REVOKE ALL ON FUNCTION public.update_merchant_social_media_internal(uuid, jsonb, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media_internal(uuid, jsonb, boolean, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_merchant_social_media(
  p_merchant_id uuid,
  p_social_media jsonb DEFAULT '{}'::jsonb,
  p_clear boolean DEFAULT false,
  p_settings jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := (SELECT auth.uid());
  v_audit_user_id uuid;
  v_actor_role text := COALESCE((SELECT auth.jwt()) ->> 'role', 'unknown');
  v_before jsonb;
  v_result jsonb;
  v_headers jsonb;
  v_should_update_social boolean := p_clear OR p_social_media <> '{}'::jsonb;
BEGIN
  IF v_should_update_social THEN
    PERFORM public.require_recent_merchant_settings_auth();

    SELECT COALESCE(m.social_media, '{}'::jsonb),
           COALESCE(v_actor_user_id, m.user_id)
      INTO v_before, v_audit_user_id
      FROM public.merchants AS m
     WHERE m.id = p_merchant_id
       FOR UPDATE;

    PERFORM pg_catalog.set_config(
      'app.merchant_sensitive_update_authorized',
      'true',
      true
    );
  END IF;

  v_result := public.update_merchant_social_media_internal(
    p_merchant_id,
    p_social_media,
    p_clear,
    p_settings
  );

  IF v_should_update_social THEN
    BEGIN
      v_headers := COALESCE(
        NULLIF(pg_catalog.current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_headers := '{}'::jsonb;
    END;

    INSERT INTO public.audit_logs (
      user_id,
      merchant_id,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent,
      status
    )
    VALUES (
      v_audit_user_id,
      p_merchant_id,
      'merchant_social_media_updated',
      'merchant',
      p_merchant_id::text,
      pg_catalog.jsonb_build_object(
        'before', v_before,
        'after', COALESCE(v_result -> 'social_media', '{}'::jsonb),
        'actor', pg_catalog.jsonb_build_object(
          'role', v_actor_role,
          'user_id', v_actor_user_id
        )
      ),
      COALESCE(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip'),
      v_headers ->> 'user-agent',
      'success'
    );
  END IF;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.update_merchant_identity_settings(uuid, jsonb, timestamptz) IS
  'Updates store identity settings with optimistic concurrency; sensitive contact changes require a live recent or AAL2 session and are audited.';
COMMENT ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) IS
  'Guarded public wrapper for atomic merchant settings/social updates; social changes require a live recent or AAL2 session and are audited.';
