-- Canonical audit coverage for sensitive merchant-row configuration. Raw bank,
-- KYC, credential, analytics, and low-entropy identifier values never enter
-- immutable audit payloads; only safe values and configured/change state do.

CREATE OR REPLACE FUNCTION private.audit_sensitive_merchant_configuration_presence_state_v1(
  p_old_present boolean,
  p_new_present boolean
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'present', COALESCE(p_new_present, false),
    'state', CASE
      WHEN NOT COALESCE(p_old_present, false)
        AND COALESCE(p_new_present, false) THEN 'configured'
      WHEN COALESCE(p_old_present, false)
        AND NOT COALESCE(p_new_present, false) THEN 'cleared'
      WHEN COALESCE(p_old_present, false)
        AND COALESCE(p_new_present, false) THEN 'rotated'
      ELSE 'unchanged'
    END
  );
$$;

ALTER FUNCTION private.audit_sensitive_merchant_configuration_presence_state_v1(
  boolean,
  boolean
) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_sensitive_merchant_configuration_presence_state_v1(
  boolean,
  boolean
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_sensitive_merchant_configuration_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Task 2 owns public identity and operational fields. Task 4 owns exactly
  -- the remaining sensitive configuration subset; the closed union is checked
  -- on every governed mutation so new columns fail closed.
  v_task2_owned_fields text[] := ARRAY[
    'about_page', 'brand_colors', 'business_address', 'business_name',
    'business_type', 'country', 'created_at', 'email', 'email_logo_url',
    'email_sender_name', 'faq_items', 'favicon_apple_touch_url',
    'favicon_png_192_url', 'favicon_png_32_url', 'favicon_svg_url',
    'favicon_uploaded_at', 'hero_image_ids', 'hero_images_generated_at',
    'hero_images_regeneration_count', 'hero_slides', 'id', 'is_published',
    'legal_entity_name', 'lga_code', 'logo_url', 'mobile_hero_slides',
    'order_prefix', 'pages', 'phone', 'plan_expires_at', 'plan_started_at',
    'published_at', 'published_config', 'registered_address',
    'self_fulfillment_enabled', 'signup_source', 'site_description',
    'site_tagline', 'site_title', 'slug', 'social_media', 'state_code',
    'support_email', 'support_phone', 'template_id', 'trust_profile',
    'updated_at'
  ]::text[];
  v_exact_fields text[] := ARRAY[
    'email_domain_verified', 'gmc_variants_enabled', 'is_platform_admin',
    'kyc_status', 'multi_currency_enabled', 'offline_conversions_enabled',
    'payout_currency', 'plan_tier', 'tax_exempt', 'vat_rate',
    'vat_registration_status'
  ]::text[];
  v_presence_fields text[] := ARRAY[
    'bank_account_name', 'bank_account_number', 'bank_code', 'bank_name',
    'bvn', 'cac_number', 'cac_rc_number', 'email_domain', 'endpoint_id',
    'endpoint_scheme_id', 'facebook_capi_access_token', 'facebook_capi_token',
    'facebook_pixel_id', 'feature_settings', 'firs_business_id',
    'firs_certificate', 'firs_email', 'firs_password_encrypted',
    'firs_public_key', 'firs_service_id', 'ga4_api_secret',
    'google_analytics_id', 'google_product_sheet_url', 'nin',
    'paystack_subaccount_code', 'premium_features', 'rider_phone_number',
    'snapchat_capi_token', 'snapchat_pixel_id', 'stripe_customer_id',
    'stripe_subscription_id', 'tax_identification_number',
    'tiktok_access_token', 'tiktok_pixel_id', 'twitter_pixel_id', 'user_id',
    'virtual_terminal_code'
  ]::text[];
  v_classified_fields text[];
  v_old_exact_values jsonb := '{}'::jsonb;
  v_new_exact_values jsonb := '{}'::jsonb;
  v_old_presence_values jsonb := '{}'::jsonb;
  v_new_presence_values jsonb := '{}'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_presence_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_old_present boolean;
  v_new_present boolean;
  v_merchant_id uuid;
  v_merchant_label text;
  v_action text;
  v_writer_capability uuid;
BEGIN
  v_classified_fields := v_task2_owned_fields || v_exact_fields ||
    v_presence_fields;
  IF pg_catalog.cardinality(v_classified_fields) <> (
    SELECT pg_catalog.count(DISTINCT classified_field.name)
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
    LEFT JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = 'public.merchants'::pg_catalog.regclass
      AND attribute.attname = classified_field.name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
    WHERE attribute.attname IS NULL
  ) THEN
    RAISE EXCEPTION 'audit_sensitive_merchant_configuration_classification_invalid'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.merchants'::pg_catalog.regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname <> ALL(v_classified_fields)
  ) THEN
    RAISE EXCEPTION 'audit_sensitive_merchant_configuration_unclassified_column'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(OLD.business_name), '');
    v_action := 'merchant.configuration.delete';
  ELSIF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.configuration.create';
  ELSE
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.configuration.update';
  END IF;
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'audit_sensitive_merchant_configuration_id_required'
      USING ERRCODE = '22023';
  END IF;
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_exact_values := pg_catalog.jsonb_build_object(
      'email_domain_verified', OLD.email_domain_verified,
      'gmc_variants_enabled', OLD.gmc_variants_enabled,
      'is_platform_admin', OLD.is_platform_admin,
      'kyc_status', OLD.kyc_status,
      'multi_currency_enabled', OLD.multi_currency_enabled,
      'offline_conversions_enabled', OLD.offline_conversions_enabled,
      'payout_currency', OLD.payout_currency,
      'plan_tier', OLD.plan_tier,
      'tax_exempt', OLD.tax_exempt, 'vat_rate', OLD.vat_rate,
      'vat_registration_status', OLD.vat_registration_status
    );
    v_old_presence_values := pg_catalog.jsonb_build_object(
      'bank_account_name', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.bank_account_name), '') IS NOT NULL),
      'bank_account_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.bank_account_number), '') IS NOT NULL),
      'bank_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.bank_code), '') IS NOT NULL),
      'bank_name', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.bank_name), '') IS NOT NULL),
      'bvn', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.bvn), '') IS NOT NULL),
      'cac_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.cac_number), '') IS NOT NULL),
      'cac_rc_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.cac_rc_number), '') IS NOT NULL),
      'email_domain', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.email_domain), '') IS NOT NULL),
      'endpoint_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.endpoint_id), '') IS NOT NULL),
      'endpoint_scheme_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.endpoint_scheme_id), '') IS NOT NULL),
      'facebook_capi_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.facebook_capi_access_token), '') IS NOT NULL),
      'facebook_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.facebook_capi_token), '') IS NOT NULL),
      'facebook_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.facebook_pixel_id), '') IS NOT NULL),
      'feature_settings', pg_catalog.jsonb_build_object('present', OLD.feature_settings IS NOT NULL AND OLD.feature_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'firs_business_id', pg_catalog.jsonb_build_object('present', OLD.firs_business_id IS NOT NULL),
      'firs_certificate', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.firs_certificate), '') IS NOT NULL),
      'firs_email', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.firs_email), '') IS NOT NULL),
      'firs_password_encrypted', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.firs_password_encrypted), '') IS NOT NULL),
      'firs_public_key', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.firs_public_key), '') IS NOT NULL),
      'firs_service_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.firs_service_id), '') IS NOT NULL),
      'ga4_api_secret', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.ga4_api_secret), '') IS NOT NULL),
      'google_analytics_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.google_analytics_id), '') IS NOT NULL),
      'google_product_sheet_url', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.google_product_sheet_url), '') IS NOT NULL),
      'nin', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.nin), '') IS NOT NULL),
      'paystack_subaccount_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.paystack_subaccount_code), '') IS NOT NULL),
      'premium_features', pg_catalog.jsonb_build_object('present', OLD.premium_features IS NOT NULL AND OLD.premium_features NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'rider_phone_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.rider_phone_number), '') IS NOT NULL),
      'snapchat_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.snapchat_capi_token), '') IS NOT NULL),
      'snapchat_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.snapchat_pixel_id), '') IS NOT NULL),
      'stripe_customer_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.stripe_customer_id), '') IS NOT NULL),
      'stripe_subscription_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.stripe_subscription_id), '') IS NOT NULL),
      'tax_identification_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.tax_identification_number), '') IS NOT NULL),
      'tiktok_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.tiktok_access_token), '') IS NOT NULL),
      'tiktok_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.tiktok_pixel_id), '') IS NOT NULL),
      'twitter_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.twitter_pixel_id), '') IS NOT NULL),
      'user_id', pg_catalog.jsonb_build_object('present', OLD.user_id IS NOT NULL),
      'virtual_terminal_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.virtual_terminal_code), '') IS NOT NULL)
    );
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_exact_values := pg_catalog.jsonb_build_object(
      'email_domain_verified', NEW.email_domain_verified,
      'gmc_variants_enabled', NEW.gmc_variants_enabled,
      'is_platform_admin', NEW.is_platform_admin,
      'kyc_status', NEW.kyc_status,
      'multi_currency_enabled', NEW.multi_currency_enabled,
      'offline_conversions_enabled', NEW.offline_conversions_enabled,
      'payout_currency', NEW.payout_currency,
      'plan_tier', NEW.plan_tier,
      'tax_exempt', NEW.tax_exempt, 'vat_rate', NEW.vat_rate,
      'vat_registration_status', NEW.vat_registration_status
    );
    v_new_presence_values := pg_catalog.jsonb_build_object(
      'bank_account_name', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.bank_account_name), '') IS NOT NULL),
      'bank_account_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.bank_account_number), '') IS NOT NULL),
      'bank_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.bank_code), '') IS NOT NULL),
      'bank_name', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.bank_name), '') IS NOT NULL),
      'bvn', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.bvn), '') IS NOT NULL),
      'cac_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.cac_number), '') IS NOT NULL),
      'cac_rc_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.cac_rc_number), '') IS NOT NULL),
      'email_domain', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.email_domain), '') IS NOT NULL),
      'endpoint_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.endpoint_id), '') IS NOT NULL),
      'endpoint_scheme_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.endpoint_scheme_id), '') IS NOT NULL),
      'facebook_capi_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.facebook_capi_access_token), '') IS NOT NULL),
      'facebook_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.facebook_capi_token), '') IS NOT NULL),
      'facebook_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.facebook_pixel_id), '') IS NOT NULL),
      'feature_settings', pg_catalog.jsonb_build_object('present', NEW.feature_settings IS NOT NULL AND NEW.feature_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'firs_business_id', pg_catalog.jsonb_build_object('present', NEW.firs_business_id IS NOT NULL),
      'firs_certificate', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.firs_certificate), '') IS NOT NULL),
      'firs_email', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.firs_email), '') IS NOT NULL),
      'firs_password_encrypted', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.firs_password_encrypted), '') IS NOT NULL),
      'firs_public_key', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.firs_public_key), '') IS NOT NULL),
      'firs_service_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.firs_service_id), '') IS NOT NULL),
      'ga4_api_secret', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.ga4_api_secret), '') IS NOT NULL),
      'google_analytics_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.google_analytics_id), '') IS NOT NULL),
      'google_product_sheet_url', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.google_product_sheet_url), '') IS NOT NULL),
      'nin', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.nin), '') IS NOT NULL),
      'paystack_subaccount_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.paystack_subaccount_code), '') IS NOT NULL),
      'premium_features', pg_catalog.jsonb_build_object('present', NEW.premium_features IS NOT NULL AND NEW.premium_features NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'rider_phone_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.rider_phone_number), '') IS NOT NULL),
      'snapchat_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.snapchat_capi_token), '') IS NOT NULL),
      'snapchat_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.snapchat_pixel_id), '') IS NOT NULL),
      'stripe_customer_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.stripe_customer_id), '') IS NOT NULL),
      'stripe_subscription_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.stripe_subscription_id), '') IS NOT NULL),
      'tax_identification_number', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.tax_identification_number), '') IS NOT NULL),
      'tiktok_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.tiktok_access_token), '') IS NOT NULL),
      'tiktok_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.tiktok_pixel_id), '') IS NOT NULL),
      'twitter_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.twitter_pixel_id), '') IS NOT NULL),
      'user_id', pg_catalog.jsonb_build_object('present', NEW.user_id IS NOT NULL),
      'virtual_terminal_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.virtual_terminal_code), '') IS NOT NULL)
    );
  END IF;

  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF TG_OP = 'INSERT' AND (v_new_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_exact_values -> v_field);
    ELSIF TG_OP = 'DELETE' AND (v_old_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_exact_values -> v_field);
    ELSIF TG_OP = 'UPDATE' AND (v_old_exact_values -> v_field) IS DISTINCT FROM (v_new_exact_values -> v_field) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_exact_values -> v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_exact_values -> v_field);
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_new_presence_values -> v_field ->> 'present')::boolean THEN
        v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, v_field);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_old_presence_values -> v_field ->> 'present')::boolean THEN
        v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, v_field);
      END IF;
    END LOOP;
  ELSE
    v_presence_changed_fields := ARRAY_REMOVE(ARRAY[
      CASE WHEN OLD.bank_account_name IS DISTINCT FROM NEW.bank_account_name THEN 'bank_account_name' END,
      CASE WHEN OLD.bank_account_number IS DISTINCT FROM NEW.bank_account_number THEN 'bank_account_number' END,
      CASE WHEN OLD.bank_code IS DISTINCT FROM NEW.bank_code THEN 'bank_code' END,
      CASE WHEN OLD.bank_name IS DISTINCT FROM NEW.bank_name THEN 'bank_name' END,
      CASE WHEN OLD.bvn IS DISTINCT FROM NEW.bvn THEN 'bvn' END,
      CASE WHEN OLD.cac_number IS DISTINCT FROM NEW.cac_number THEN 'cac_number' END,
      CASE WHEN OLD.cac_rc_number IS DISTINCT FROM NEW.cac_rc_number THEN 'cac_rc_number' END,
      CASE WHEN OLD.email_domain IS DISTINCT FROM NEW.email_domain THEN 'email_domain' END,
      CASE WHEN OLD.endpoint_id IS DISTINCT FROM NEW.endpoint_id THEN 'endpoint_id' END,
      CASE WHEN OLD.endpoint_scheme_id IS DISTINCT FROM NEW.endpoint_scheme_id THEN 'endpoint_scheme_id' END,
      CASE WHEN OLD.facebook_capi_access_token IS DISTINCT FROM NEW.facebook_capi_access_token THEN 'facebook_capi_access_token' END,
      CASE WHEN OLD.facebook_capi_token IS DISTINCT FROM NEW.facebook_capi_token THEN 'facebook_capi_token' END,
      CASE WHEN OLD.facebook_pixel_id IS DISTINCT FROM NEW.facebook_pixel_id THEN 'facebook_pixel_id' END,
      CASE WHEN OLD.feature_settings IS DISTINCT FROM NEW.feature_settings THEN 'feature_settings' END,
      CASE WHEN OLD.firs_business_id IS DISTINCT FROM NEW.firs_business_id THEN 'firs_business_id' END,
      CASE WHEN OLD.firs_certificate IS DISTINCT FROM NEW.firs_certificate THEN 'firs_certificate' END,
      CASE WHEN OLD.firs_email IS DISTINCT FROM NEW.firs_email THEN 'firs_email' END,
      CASE WHEN OLD.firs_password_encrypted IS DISTINCT FROM NEW.firs_password_encrypted THEN 'firs_password_encrypted' END,
      CASE WHEN OLD.firs_public_key IS DISTINCT FROM NEW.firs_public_key THEN 'firs_public_key' END,
      CASE WHEN OLD.firs_service_id IS DISTINCT FROM NEW.firs_service_id THEN 'firs_service_id' END,
      CASE WHEN OLD.ga4_api_secret IS DISTINCT FROM NEW.ga4_api_secret THEN 'ga4_api_secret' END,
      CASE WHEN OLD.google_analytics_id IS DISTINCT FROM NEW.google_analytics_id THEN 'google_analytics_id' END,
      CASE WHEN OLD.google_product_sheet_url IS DISTINCT FROM NEW.google_product_sheet_url THEN 'google_product_sheet_url' END,
      CASE WHEN OLD.nin IS DISTINCT FROM NEW.nin THEN 'nin' END,
      CASE WHEN OLD.paystack_subaccount_code IS DISTINCT FROM NEW.paystack_subaccount_code THEN 'paystack_subaccount_code' END,
      CASE WHEN OLD.premium_features IS DISTINCT FROM NEW.premium_features THEN 'premium_features' END,
      CASE WHEN OLD.rider_phone_number IS DISTINCT FROM NEW.rider_phone_number THEN 'rider_phone_number' END,
      CASE WHEN OLD.snapchat_capi_token IS DISTINCT FROM NEW.snapchat_capi_token THEN 'snapchat_capi_token' END,
      CASE WHEN OLD.snapchat_pixel_id IS DISTINCT FROM NEW.snapchat_pixel_id THEN 'snapchat_pixel_id' END,
      CASE WHEN OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN 'stripe_customer_id' END,
      CASE WHEN OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id THEN 'stripe_subscription_id' END,
      CASE WHEN OLD.tax_identification_number IS DISTINCT FROM NEW.tax_identification_number THEN 'tax_identification_number' END,
      CASE WHEN OLD.tiktok_access_token IS DISTINCT FROM NEW.tiktok_access_token THEN 'tiktok_access_token' END,
      CASE WHEN OLD.tiktok_pixel_id IS DISTINCT FROM NEW.tiktok_pixel_id THEN 'tiktok_pixel_id' END,
      CASE WHEN OLD.twitter_pixel_id IS DISTINCT FROM NEW.twitter_pixel_id THEN 'twitter_pixel_id' END,
      CASE WHEN OLD.user_id IS DISTINCT FROM NEW.user_id THEN 'user_id' END,
      CASE WHEN OLD.virtual_terminal_code IS DISTINCT FROM NEW.virtual_terminal_code THEN 'virtual_terminal_code' END
    ]::text[], NULL);
  END IF;

  FOREACH v_field IN ARRAY v_presence_changed_fields LOOP
    v_old_present := COALESCE((v_old_presence_values -> v_field ->> 'present')::boolean, false);
    v_new_present := COALESCE((v_new_presence_values -> v_field ->> 'present')::boolean, false);
    IF TG_OP = 'UPDATE' AND NOT v_old_present AND NOT v_new_present THEN
      CONTINUE;
    END IF;
    v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
    IF TG_OP <> 'INSERT' THEN
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field, pg_catalog.jsonb_build_object('present', v_old_present)
      );
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field,
        private.audit_sensitive_merchant_configuration_presence_state_v1(
          v_old_present, v_new_present
        )
      );
    END IF;
  END LOOP;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_sensitive_merchant_configuration_payload_too_large'
      USING ERRCODE = '54000';
  END IF;

  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_sensitive_merchant_configuration_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    v_merchant_id, v_merchant_label, v_action, 'merchant'::text,
    v_merchant_id::text, v_changed_fields, NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb), NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'merchant_configuration', 'operation', pg_catalog.lower(TG_OP)
    ), v_writer_capability
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_sensitive_merchant_configuration_change_v1()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_sensitive_merchant_configuration_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_sensitive_merchant_configuration_change_v1 ON public.merchants;
CREATE TRIGGER audit_sensitive_merchant_configuration_change_v1
  AFTER INSERT OR DELETE OR UPDATE OF
    bank_account_name, bank_account_number, bank_code, bank_name, bvn,
    cac_number, cac_rc_number, email_domain, email_domain_verified, endpoint_id,
    endpoint_scheme_id, facebook_capi_access_token, facebook_capi_token,
    facebook_pixel_id, feature_settings, firs_business_id, firs_certificate,
    firs_email, firs_password_encrypted, firs_public_key, firs_service_id,
    ga4_api_secret, gmc_variants_enabled, google_analytics_id,
    google_product_sheet_url, is_platform_admin, kyc_status,
    multi_currency_enabled, nin, offline_conversions_enabled, payout_currency,
    paystack_subaccount_code, plan_tier, premium_features, rider_phone_number,
    snapchat_capi_token, snapchat_pixel_id, stripe_customer_id,
    stripe_subscription_id, tax_exempt, tax_identification_number,
    tiktok_access_token, tiktok_pixel_id, twitter_pixel_id, user_id, vat_rate,
    vat_registration_status, virtual_terminal_code
  ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_sensitive_merchant_configuration_change_v1();
