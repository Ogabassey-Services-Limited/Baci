-- Keep merchant-column classification fail-closed independently of the legacy
-- payload trigger, so new columns cannot bypass the audit contract.

CREATE OR REPLACE FUNCTION private.assert_merchant_identity_schema_classified_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exact_fields text[] := ARRAY[
    'business_name', 'country', 'email_logo_url', 'email_sender_name',
    'favicon_apple_touch_url', 'favicon_png_192_url', 'favicon_png_32_url',
    'favicon_svg_url', 'is_published', 'legal_entity_name', 'logo_url',
    'site_description', 'site_tagline', 'site_title', 'slug', 'social_media',
    'support_email', 'support_phone'
  ]::text[];
  v_presence_fields text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ]::text[];
  v_delegated_fields text[] := ARRAY[
    'bank_account_name', 'bank_code', 'bank_name', 'email_domain',
    'email_domain_verified', 'endpoint_scheme_id', 'facebook_pixel_id',
    'feature_settings', 'firs_business_id', 'firs_service_id',
    'gmc_variants_enabled', 'google_analytics_id', 'is_platform_admin',
    'kyc_status', 'multi_currency_enabled', 'offline_conversions_enabled',
    'paystack_subaccount_code', 'payout_currency', 'plan_tier',
    'premium_features', 'snapchat_pixel_id', 'stripe_customer_id',
    'stripe_subscription_id', 'tax_exempt', 'tiktok_pixel_id',
    'twitter_pixel_id', 'user_id', 'vat_rate', 'vat_registration_status'
  ]::text[];
  v_forbidden_fields text[] := ARRAY[
    'bank_account_number', 'bvn', 'cac_number', 'cac_rc_number', 'endpoint_id',
    'facebook_capi_access_token', 'facebook_capi_token', 'firs_certificate',
    'firs_email', 'firs_password_encrypted', 'firs_public_key',
    'ga4_api_secret', 'google_product_sheet_url', 'nin', 'rider_phone_number',
    'snapchat_capi_token', 'tax_identification_number', 'tiktok_access_token',
    'virtual_terminal_code'
  ]::text[];
  v_ignored_fields text[] := ARRAY[
    'about_page', 'brand_colors', 'business_type', 'created_at',
    'favicon_uploaded_at', 'faq_items', 'hero_image_ids',
    'hero_images_generated_at', 'hero_images_regeneration_count', 'hero_slides',
    'id', 'mobile_hero_slides', 'order_prefix', 'pages', 'plan_expires_at',
    'plan_started_at', 'published_at', 'published_config',
    'self_fulfillment_enabled', 'signup_source', 'template_id', 'trust_profile',
    'updated_at'
  ]::text[];
  v_classified_fields text[];
BEGIN
  v_classified_fields := v_exact_fields || v_presence_fields ||
    v_delegated_fields || v_forbidden_fields || v_ignored_fields;

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
    RAISE EXCEPTION 'audit_merchant_identity_classification_invalid'
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
    RAISE EXCEPTION 'audit_merchant_identity_unclassified_column'
      USING ERRCODE = '55000';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.assert_merchant_identity_schema_classified_v2()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.assert_merchant_identity_schema_classified_v2()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_identity_schema_guard_v2 ON public.merchants;
CREATE TRIGGER audit_merchant_identity_schema_guard_v2
  BEFORE INSERT OR DELETE OR UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION private.assert_merchant_identity_schema_classified_v2();
