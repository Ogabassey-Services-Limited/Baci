-- Compare normalized social state while holding the merchant row lock. A full
-- settings-form draft that is semantically unchanged must not require recent
-- authentication, touch updated_at, or create an audit record.
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
  v_after jsonb;
  v_result jsonb;
  v_headers jsonb;
  v_requested_social boolean := p_clear OR p_social_media <> '{}'::jsonb;
  v_social_changed boolean := false;
  v_vat_registration_status text;
  v_tax_identification_number text;
  v_legal_entity_name text;
  v_registered_address jsonb;
  v_state_code character varying(10);
  v_updated_at timestamptz;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.check_staff_permission(
      v_actor_user_id,
      p_merchant_id,
      'settings',
      'edit'
    ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_social_media IS NULL
    OR pg_catalog.jsonb_typeof(p_social_media) <> 'object' THEN
    RAISE EXCEPTION 'invalid_social_media_payload' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_social_media) AS social_key(key)
     WHERE social_key.key NOT IN (
       'twitter',
       'facebook',
       'instagram',
       'tiktok',
       'youtube',
       'pinterest',
       'linkedin',
       'snapchat'
     )
  ) THEN
    RAISE EXCEPTION 'invalid_social_media_key' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_each(p_social_media) AS social_entry(key, value)
     WHERE pg_catalog.jsonb_typeof(social_entry.value) NOT IN ('string', 'null')
        OR (
          pg_catalog.jsonb_typeof(social_entry.value) = 'string'
          AND pg_catalog.length(
            pg_catalog.btrim(social_entry.value #>> '{}')
          ) > 255
        )
  ) THEN
    RAISE EXCEPTION 'invalid_social_media_value' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(m.social_media, '{}'::jsonb),
         COALESCE(v_actor_user_id, m.user_id),
         m.vat_registration_status,
         m.tax_identification_number,
         m.legal_entity_name,
         m.registered_address,
         m.state_code,
         m.updated_at
    INTO v_before,
         v_audit_user_id,
         v_vat_registration_status,
         v_tax_identification_number,
         v_legal_entity_name,
         v_registered_address,
         v_state_code,
         v_updated_at
    FROM public.merchants AS m
   WHERE m.id = p_merchant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_requested_social THEN
    SELECT COALESCE(
             pg_catalog.jsonb_object_agg(
               social_entry.key,
               pg_catalog.to_jsonb(
                 pg_catalog.btrim(social_entry.value #>> '{}')
               )
             ),
             '{}'::jsonb
           )
      INTO v_after
      FROM pg_catalog.jsonb_each(
             (CASE
                WHEN p_clear THEN '{}'::jsonb
                ELSE v_before
              END) || p_social_media
           ) AS social_entry(key, value)
     WHERE social_entry.key IN (
             'twitter',
             'facebook',
             'instagram',
             'tiktok',
             'youtube',
             'pinterest',
             'linkedin',
             'snapchat'
           )
       AND pg_catalog.jsonb_typeof(social_entry.value) = 'string'
       AND pg_catalog.btrim(social_entry.value #>> '{}') <> '';

    v_social_changed := v_after IS DISTINCT FROM v_before;
  END IF;

  IF v_social_changed THEN
    PERFORM public.require_recent_merchant_settings_auth(false);
    PERFORM pg_catalog.set_config(
      'app.merchant_sensitive_update_authorized',
      'true',
      true
    );
  ELSIF v_requested_social AND p_settings = '{}'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object(
      'id', p_merchant_id,
      'social_media', v_before,
      'vat_registration_status', v_vat_registration_status,
      'tax_identification_number', v_tax_identification_number,
      'legal_entity_name', v_legal_entity_name,
      'registered_address', v_registered_address,
      'state_code', v_state_code,
      'updated_at', v_updated_at
    );
  END IF;

  v_result := public.update_merchant_social_media_internal(
    p_merchant_id,
    CASE WHEN v_social_changed THEN p_social_media ELSE '{}'::jsonb END,
    p_clear AND v_social_changed,
    p_settings
  );

  IF v_social_changed THEN
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

COMMENT ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) IS
  'Guarded atomic merchant settings/social update. Social authentication and audit apply only when normalized state changes.';
