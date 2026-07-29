-- Guarded merchant profile update RPC. Sensitive contact fields use the
-- session boundary installed by the preceding migration and emit audit rows.

CREATE OR REPLACE FUNCTION public.update_merchant_identity_settings(
  p_merchant_id uuid,
  p_settings jsonb,
  p_expected_updated_at timestamptz
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
  v_sensitive_change boolean;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF p_settings IS NULL
    OR pg_catalog.jsonb_typeof(p_settings) <> 'object'
    OR p_settings = '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid_settings_payload' USING ERRCODE = '22023';
  END IF;

  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'merchant_settings_concurrency_token_required'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_settings) AS setting_key(key)
     WHERE setting_key.key NOT IN (
       'business_name',
       'phone',
       'support_phone',
       'support_email',
       'business_address',
       'country',
       'payout_currency',
       'slug'
     )
  ) THEN
    RAISE EXCEPTION 'invalid_settings_key' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.jwt()) ->> 'role', '') <> 'service_role'
    AND NOT public.check_staff_permission(
      v_actor_user_id,
      p_merchant_id,
      'settings',
      'edit'
    ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_each(p_settings) AS setting(key, value)
     WHERE setting.key IN (
       'business_name', 'phone', 'support_phone', 'support_email',
       'business_address', 'country', 'payout_currency', 'slug'
     )
       AND pg_catalog.jsonb_typeof(setting.value) NOT IN ('string', 'null')
  ) THEN
    RAISE EXCEPTION 'invalid_settings_value' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'support_email'
    AND NULLIF(pg_catalog.btrim(p_settings ->> 'support_email'), '') IS NOT NULL
    AND (
      pg_catalog.length(pg_catalog.btrim(p_settings ->> 'support_email')) > 255
      OR pg_catalog.btrim(p_settings ->> 'support_email') !~
        '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) THEN
    RAISE EXCEPTION 'invalid_support_email' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES ('phone'), ('support_phone')) AS phone_key(key)
     WHERE p_settings ? phone_key.key
       AND NULLIF(pg_catalog.btrim(p_settings ->> phone_key.key), '') IS NOT NULL
       AND (
         pg_catalog.length(pg_catalog.btrim(p_settings ->> phone_key.key)) > 32
         OR pg_catalog.btrim(p_settings ->> phone_key.key) !~ '^[+0-9() .-]{7,32}$'
       )
  ) THEN
    RAISE EXCEPTION 'invalid_support_phone' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'business_name'
    AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'business_name')) > 255 THEN
    RAISE EXCEPTION 'invalid_business_name' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'business_address'
    AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'business_address')) > 500 THEN
    RAISE EXCEPTION 'invalid_business_address' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'country'
    AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'country')) > 100 THEN
    RAISE EXCEPTION 'invalid_country' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'payout_currency'
    AND NULLIF(pg_catalog.btrim(p_settings ->> 'payout_currency'), '') IS NOT NULL
    AND pg_catalog.upper(pg_catalog.btrim(p_settings ->> 'payout_currency')) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'invalid_payout_currency' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'slug'
    AND NULLIF(pg_catalog.btrim(p_settings ->> 'slug'), '') IS NOT NULL
    AND pg_catalog.btrim(p_settings ->> 'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE = '22023';
  END IF;

  v_sensitive_change := p_settings ?| ARRAY[
    'support_email', 'phone', 'support_phone'
  ];

  IF v_sensitive_change THEN
    PERFORM public.require_recent_merchant_settings_auth();
  END IF;

  SELECT pg_catalog.jsonb_build_object(
           'support_email', m.support_email,
           'phone', m.phone,
           'support_phone', m.support_phone
         ),
         COALESCE(v_actor_user_id, m.user_id)
    INTO v_before, v_audit_user_id
    FROM public.merchants AS m
   WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_sensitive_change THEN
    PERFORM pg_catalog.set_config(
      'app.merchant_sensitive_update_authorized',
      'true',
      true
    );
  END IF;

  UPDATE public.merchants AS m
     SET business_name = CASE
           WHEN p_settings ? 'business_name'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'business_name'), '')
           ELSE m.business_name
         END,
         phone = CASE
           WHEN p_settings ? 'phone'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'phone'), '')
           ELSE m.phone
         END,
         support_phone = CASE
           WHEN p_settings ? 'support_phone'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'support_phone'), '')
           ELSE m.support_phone
         END,
         support_email = CASE
           WHEN p_settings ? 'support_email'
             THEN NULLIF(pg_catalog.lower(pg_catalog.btrim(p_settings ->> 'support_email')), '')
           ELSE m.support_email
         END,
         business_address = CASE
           WHEN p_settings ? 'business_address'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'business_address'), '')
           ELSE m.business_address
         END,
         country = CASE
           WHEN p_settings ? 'country'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'country'), '')
           ELSE m.country
         END,
         payout_currency = CASE
           WHEN p_settings ? 'payout_currency'
             THEN NULLIF(pg_catalog.upper(pg_catalog.btrim(p_settings ->> 'payout_currency')), '')
           ELSE m.payout_currency
         END,
         slug = CASE
           WHEN p_settings ? 'slug'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'slug'), '')
           ELSE m.slug
         END,
         updated_at = pg_catalog.now()
   WHERE m.id = p_merchant_id
     AND m.updated_at = p_expected_updated_at
   RETURNING pg_catalog.jsonb_build_object(
     'id', m.id,
     'business_name', m.business_name,
     'phone', m.phone,
     'support_phone', m.support_phone,
     'support_email', m.support_email,
     'business_address', m.business_address,
     'country', m.country,
     'payout_currency', m.payout_currency,
     'slug', m.slug,
     'updated_at', m.updated_at
   )
   INTO v_result;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.merchants WHERE id = p_merchant_id) THEN
      RAISE EXCEPTION 'merchant_settings_conflict' USING ERRCODE = '40001';
    END IF;
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_sensitive_change THEN
    v_after := pg_catalog.jsonb_build_object(
      'support_email', v_result -> 'support_email',
      'phone', v_result -> 'phone',
      'support_phone', v_result -> 'support_phone'
    );

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
      'merchant_identity_settings_updated',
      'merchant',
      p_merchant_id::text,
      pg_catalog.jsonb_build_object(
        'before', v_before,
        'after', v_after,
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

ALTER FUNCTION public.update_merchant_identity_settings(uuid, jsonb, timestamptz)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_merchant_identity_settings(uuid, jsonb, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_merchant_identity_settings(uuid, jsonb, timestamptz)
  TO authenticated, service_role;
