-- The mobile provisioning RPC is intentionally SECURITY INVOKER, and its
-- policy-health contract verifies that property. Rebuild its exact deployed
-- definition with one transaction-local capability immediately before the
-- existing retry loop, rather than weakening direct merchant updates.
DO $$
DECLARE
  v_provisioning_definition text;
  v_marker CONSTANT text := '  WHILE v_slug_attempt < v_max_slug_attempts LOOP';
  v_replacement CONSTANT text :=
    '  PERFORM pg_catalog.set_config(''app.merchant_sensitive_update_authorized'', ''true'', true);'
    || E'\n\n'
    || '  WHILE v_slug_attempt < v_max_slug_attempts LOOP';
  v_is_security_definer boolean;
  v_marker_count integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
           'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'::pg_catalog.regprocedure
         ),
         (SELECT function_row.prosecdef
            FROM pg_catalog.pg_proc AS function_row
           WHERE function_row.oid =
             'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'::pg_catalog.regprocedure)
    INTO v_provisioning_definition, v_is_security_definer;

  IF v_is_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'mobile_provisioning_security_mode_drift';
  END IF;

  v_marker_count := (
    pg_catalog.length(v_provisioning_definition)
    - pg_catalog.length(pg_catalog.replace(v_provisioning_definition, v_marker, ''))
  ) / pg_catalog.length(v_marker);
  IF v_marker_count <> 1 THEN
    RAISE EXCEPTION 'mobile_provisioning_definition_anchor_drift';
  END IF;

  EXECUTE pg_catalog.replace(
    v_provisioning_definition,
    v_marker,
    v_replacement
  );
END;
$$;

-- Contact/payment identity changes retain their stricter MFA policy. Social
-- branding changes keep the same live-session and recent-primary-auth checks,
-- but do not require AAL2: the web settings surface has no MFA challenge path.
CREATE OR REPLACE FUNCTION public.require_recent_merchant_settings_auth(
  p_require_mfa boolean
)
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
      FROM auth.sessions AS session_row
     WHERE session_row.id = v_session_id
       AND session_row.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'merchant_settings_reauthentication_required'
      USING ERRCODE = '42501';
  END IF;

  v_aal := COALESCE(v_jwt ->> 'aal', 'aal1');

  IF COALESCE(p_require_mfa, true) THEN
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

ALTER FUNCTION public.require_recent_merchant_settings_auth(boolean)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.require_recent_merchant_settings_auth(boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.require_recent_merchant_settings_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.require_recent_merchant_settings_auth(true);
END;
$$;

ALTER FUNCTION public.require_recent_merchant_settings_auth() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.require_recent_merchant_settings_auth()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_recent_merchant_settings_auth()
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
    PERFORM public.require_recent_merchant_settings_auth(false);

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

COMMENT ON FUNCTION public.require_recent_merchant_settings_auth(boolean) IS
  'Private session gate for merchant settings. p_require_mfa=true enforces verified-MFA AAL2; false retains live-session and recent-primary-auth checks only.';
COMMENT ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) IS
  'Guarded public wrapper for atomic merchant settings/social updates; social changes require a live, recent authenticated session and are audited.';
