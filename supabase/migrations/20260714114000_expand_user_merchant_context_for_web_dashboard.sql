-- Expand the existing caller-bound merchant context RPC so the web dashboard
-- can keep reading its own bounded projection after authenticated column grants
-- on public.merchants are tightened. The function pins all lookup scope to
-- auth.uid(); callers cannot supply a merchant or user id.

CREATE OR REPLACE FUNCTION public.get_user_merchant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_merchant_id uuid;
  v_is_owner boolean := false;
  v_is_staff boolean := false;
  v_staff_role public.staff_role;
  v_role_permissions jsonb := '{}'::jsonb;
  v_custom_permissions jsonb := '{}'::jsonb;
  v_permissions jsonb := '{}'::jsonb;
  v_can_settings boolean := false;
  v_can_products boolean := false;
  v_merchant_data jsonb;
  v_feature_settings jsonb;
  v_domain_data jsonb;
  v_staff_access jsonb;
BEGIN
  IF COALESCE((SELECT auth.role()), '') NOT IN ('authenticated', 'service_role')
    OR v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id
    INTO v_merchant_id
  FROM public.merchants AS m
  WHERE m.user_id = v_user_id
    AND (m.business_name IS NOT NULL OR m.slug IS NOT NULL)
  ORDER BY m.id ASC
  LIMIT 1;

  IF v_merchant_id IS NOT NULL THEN
    v_is_owner := true;
    v_permissions := '{"full_access":{"all":true}}'::jsonb;
  ELSE
    SELECT
      sm.merchant_id,
      sm.role,
      COALESCE(rp.permissions, '{}'::jsonb),
      COALESCE(sm.permissions, '{}'::jsonb)
      INTO
        v_merchant_id,
        v_staff_role,
        v_role_permissions,
        v_custom_permissions
    FROM public.staff_members AS sm
    LEFT JOIN public.role_permissions AS rp ON rp.role = sm.role
    WHERE sm.user_id = v_user_id
      AND sm.status = 'active'
    ORDER BY sm.id ASC
    LIMIT 1;

    IF v_merchant_id IS NOT NULL THEN
      v_is_staff := true;

      SELECT COALESCE(
        pg_catalog.jsonb_object_agg(
          permission_key,
          COALESCE(v_role_permissions -> permission_key, '{}'::jsonb)
            || COALESCE(v_custom_permissions -> permission_key, '{}'::jsonb)
        ),
        '{}'::jsonb
      )
      INTO v_permissions
      FROM (
        SELECT pg_catalog.jsonb_object_keys(v_role_permissions) AS permission_key
        UNION
        SELECT pg_catalog.jsonb_object_keys(v_custom_permissions) AS permission_key
      ) AS permission_keys;

      v_can_settings :=
        v_permissions @> '{"full_access":{"all":true}}'::jsonb
        OR v_permissions @> '{"*":{"*":true}}'::jsonb
        OR v_permissions @> '{"*":{"view":true}}'::jsonb
        OR v_permissions @> '{"*":{"edit":true}}'::jsonb
        OR v_permissions @> '{"settings":{"*":true}}'::jsonb
        OR v_permissions @> '{"settings":{"all":true}}'::jsonb
        OR v_permissions @> '{"settings":{"view":true}}'::jsonb
        OR v_permissions @> '{"settings":{"edit":true}}'::jsonb;

      v_can_products :=
        v_permissions @> '{"full_access":{"all":true}}'::jsonb
        OR v_permissions @> '{"*":{"*":true}}'::jsonb
        OR v_permissions @> '{"*":{"view":true}}'::jsonb
        OR v_permissions @> '{"*":{"edit":true}}'::jsonb
        OR v_permissions @> '{"products":{"*":true}}'::jsonb
        OR v_permissions @> '{"products":{"all":true}}'::jsonb
        OR v_permissions @> '{"products":{"view":true}}'::jsonb
        OR v_permissions @> '{"products":{"edit":true}}'::jsonb;
    END IF;
  END IF;

  IF v_merchant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.to_jsonb(projected)
    INTO v_merchant_data
  FROM (
    SELECT
      m.id,
      m.user_id,
      m.business_name,
      m.business_type,
      m.email,
      m.phone,
      m.logo_url,
      m.brand_colors,
      m.country,
      m.payout_currency,
      m.pages,
      CASE WHEN v_is_owner OR v_can_products
        THEN m.google_product_sheet_url END AS google_product_sheet_url,
      m.slug,
      m.published_config,
      m.favicon_svg_url,
      m.favicon_png_32_url,
      m.favicon_png_192_url,
      m.favicon_apple_touch_url,
      m.favicon_uploaded_at,
      m.social_media,
      m.support_email,
      m.support_phone,
      m.business_address,
      m.rider_phone_number,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.paystack_subaccount_code END AS paystack_subaccount_code,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.bank_account_number END AS bank_account_number,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.bank_account_name END AS bank_account_name,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.bank_code END AS bank_code,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.bank_name END AS bank_name,
      m.is_published,
      m.published_at,
      m.template_id,
      m.plan_tier,
      m.premium_features,
      m.hero_slides,
      m.mobile_hero_slides,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.legal_entity_name END AS legal_entity_name,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.registered_address END AS registered_address,
      CASE WHEN v_is_owner OR v_can_settings
        THEN m.tax_identification_number END AS tax_identification_number,
      m.trust_profile,
      m.plan_started_at,
      m.plan_expires_at,
      CASE WHEN v_is_owner THEN m.stripe_customer_id END AS stripe_customer_id,
      CASE WHEN v_is_owner THEN m.stripe_subscription_id END AS stripe_subscription_id,
      m.offline_conversions_enabled,
      m.facebook_pixel_id,
      CASE WHEN v_is_owner THEN m.facebook_capi_token END AS facebook_capi_token,
      m.google_analytics_id,
      CASE WHEN v_is_owner THEN m.ga4_api_secret END AS ga4_api_secret,
      m.tiktok_pixel_id,
      CASE WHEN v_is_owner THEN m.tiktok_access_token END AS tiktok_access_token,
      m.snapchat_pixel_id,
      CASE WHEN v_is_owner THEN m.snapchat_capi_token END AS snapchat_capi_token,
      m.twitter_pixel_id,
      CASE WHEN v_is_owner THEN m.virtual_terminal_code END AS virtual_terminal_code,
      m.vat_registration_status,
      m.vat_rate,
      CASE WHEN v_is_owner THEN m.nin END AS nin,
      CASE WHEN v_is_owner THEN m.bvn END AS bvn,
      CASE WHEN v_is_owner OR v_can_settings THEN m.cac_rc_number END AS cac_rc_number,
      CASE WHEN v_is_owner OR v_can_settings THEN m.kyc_status END AS kyc_status,
      CASE WHEN v_is_owner OR v_can_settings THEN m.state_code END AS state_code,
      m.updated_at
    FROM public.merchants AS m
    WHERE m.id = v_merchant_id
  ) AS projected;

  SELECT pg_catalog.to_jsonb(fs)
    INTO v_feature_settings
  FROM public.merchant_feature_settings AS fs
  WHERE fs.merchant_id = v_merchant_id
  LIMIT 1;

  v_merchant_data := v_merchant_data || pg_catalog.jsonb_build_object(
    'feature_settings',
    v_feature_settings
  );

  SELECT pg_catalog.to_jsonb(d)
    INTO v_domain_data
  FROM (
    SELECT id, domain, is_primary, status, domain_type
    FROM public.domains
    WHERE merchant_id = v_merchant_id
      AND is_primary = true
      AND status = 'active'
    LIMIT 1
  ) AS d;

  v_staff_access := pg_catalog.jsonb_build_object(
    'isStaff', v_is_staff,
    'isOwner', v_is_owner,
    'role', v_staff_role,
    'permissions', v_permissions
  );

  RETURN pg_catalog.jsonb_build_object(
    'merchant', v_merchant_data,
    'primaryDomain', COALESCE(v_domain_data, 'null'::jsonb),
    'staffAccess', v_staff_access
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_merchant_context() IS
  'Returns the caller-bound owner/staff dashboard merchant projection, primary domain, and effective staff access.';

REVOKE EXECUTE ON FUNCTION public.get_user_merchant_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_merchant_context() TO authenticated, service_role;
