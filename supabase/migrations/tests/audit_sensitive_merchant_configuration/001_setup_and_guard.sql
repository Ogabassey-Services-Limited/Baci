-- Regression contract for 20260730000300_audit_sensitive_merchant_configuration.sql.
-- This fixture runs after every pending migration and rolls back all rows.

BEGIN;

CREATE TEMP TABLE audit_sensitive_event_counts (
  label text PRIMARY KEY,
  event_count integer NOT NULL
);

CREATE TEMP TABLE audit_sensitive_redaction_sentinels (
  lifecycle text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (lifecycle, value)
);

CREATE FUNCTION pg_temp.assert_task4_redacted_audit_rows(
  p_audit_text text,
  p_sentinels text[],
  p_lifecycle text
)
RETURNS void
LANGUAGE plpgsql
AS $assert$
DECLARE
  v_sentinel text;
  v_suffix text;
  v_masked_suffix text;
  v_fixed_width_masked_suffix text;
  v_md5 text;
  v_sha256 text;
BEGIN
  IF NULLIF(p_audit_text, '') IS NULL THEN
    RAISE EXCEPTION '% redaction assertion did not receive serialized audit rows',
      p_lifecycle;
  END IF;
  IF COALESCE(pg_catalog.cardinality(p_sentinels), 0) = 0 THEN
    RAISE EXCEPTION '% redaction assertion did not receive sentinels',
      p_lifecycle;
  END IF;

  FOREACH v_sentinel IN ARRAY p_sentinels LOOP
    v_suffix := pg_catalog.right(v_sentinel, 4);
    v_masked_suffix := '****' || v_suffix;
    v_fixed_width_masked_suffix := pg_catalog.repeat(
      '*',
      GREATEST(pg_catalog.char_length(v_sentinel) - pg_catalog.char_length(v_suffix), 1)
    ) || v_suffix;
    v_md5 := pg_catalog.md5(v_sentinel);
    v_sha256 := pg_catalog.encode(extensions.digest(v_sentinel, 'sha256'), 'hex');

    IF pg_catalog.strpos(p_audit_text, v_sentinel) > 0
       OR pg_catalog.strpos(p_audit_text, v_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_masked_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_fixed_width_masked_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_md5) > 0
       OR pg_catalog.strpos(p_audit_text, v_sha256) > 0 THEN
      RAISE EXCEPTION '% audit row leaked raw, suffix, masked, or unsalted-hash sensitive evidence',
        p_lifecycle;
    END IF;
  END LOOP;
END;
$assert$;

DO $test$
BEGIN
  BEGIN
    PERFORM pg_temp.assert_task4_redacted_audit_rows(
      'serialized audit row', NULL::text[], 'null sentinel corpus'
    );
    RAISE EXCEPTION 'null sentinel corpus unexpectedly bypassed redaction assertion';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'null sentinel corpus redaction assertion did not receive sentinels' THEN
      RAISE;
    END IF;
  END;
  BEGIN
    PERFORM pg_temp.assert_task4_redacted_audit_rows(
      'serialized audit row', ARRAY[]::text[], 'empty sentinel corpus'
    );
    RAISE EXCEPTION 'empty sentinel corpus unexpectedly bypassed redaction assertion';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'empty sentinel corpus redaction assertion did not receive sentinels' THEN
      RAISE;
    END IF;
  END;
END;
$test$;

-- These sentinels cover every high-risk lifecycle class. Their final four
-- characters intentionally use non-hex letters so full-row UUID/hash noise
-- cannot make the last-four regression flaky.
INSERT INTO audit_sensitive_redaction_sentinels (lifecycle, value) VALUES
  ('clear', 'task4-analytics-token-sentinel-QWZX'),
  ('clear', 'task4-analytics-rotated-sentinel-RSTV'),
  ('create_delete', 'task4-delete-bank-account-name-sentinel-QWZX'),
  ('create_delete', 'task4-delete-bank-number-sentinel-RSTV'),
  ('create_delete', 'task4-delete-bank-code-sentinel-WXQR'),
  ('create_delete', 'task4-delete-bank-provider-sentinel-ZTVW'),
  ('create_delete', 'task4-delete-bvn-sentinel-QXWZ'),
  ('create_delete', 'task4-delete-cac-number-sentinel-RVWX'),
  ('create_delete', 'task4-delete-cac-rc-sentinel-ZQRT'),
  ('create_delete', 'task4-delete-nin-sentinel-QVRX'),
  ('create_delete', 'task4-delete-tin-sentinel-TWZX'),
  ('create_delete', 'https://task4-delete-certificate-sentinel.example/certificate-WXYZ'),
  ('create_delete', 'task4-delete-firs-password-sentinel-QRTV'),
  ('create_delete', 'task4-delete-firs-public-key-sentinel-WXZY'),
  -- firs_service_id is varchar(8) in the live schema.
  ('create_delete', 'FIRSQWZX'),
  ('create_delete', 'task4-delete-analytics-secret-sentinel-QXTV'),
  ('create_delete', 'task4-delete-facebook-token-sentinel-WZQR'),
  ('create_delete', 'task4-delete-facebook-capi-token-sentinel-XWZR'),
  ('create_delete', 'task4-delete-facebook-pixel-sentinel-QVWX'),
  ('create_delete', 'task4-delete-snapchat-token-sentinel-RTWX'),
  ('create_delete', 'task4-delete-snapchat-pixel-sentinel-ZTRW'),
  ('create_delete', 'task4-delete-tiktok-token-sentinel-VZQW'),
  ('create_delete', 'task4-delete-tiktok-pixel-sentinel-WXVT'),
  ('create_delete', 'task4-delete-twitter-pixel-sentinel-QZRW'),
  ('create_delete', 'task4-delete-google-analytics-sentinel-XQTR'),
  ('create_delete', 'https://task4-delete-product-sheet-sentinel.example/feed-WXQZ'),
  ('create_delete', 'task4-delete-paystack-subaccount-sentinel-RXWQ'),
  ('create_delete', 'task4-delete-feature-settings-sentinel-ZQWX'),
  ('create_delete', 'task4-delete-premium-feature-sentinel-VWXR');

DO $test$
DECLARE
  v_actor_id uuid := '7e3f2e40-0000-4000-8000-000000000001';
  v_merchant_id uuid := '7e3f2e40-0000-4000-8000-000000000002';
  v_live_columns text[];
  v_task2_owned_columns text[] := ARRAY[
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
  ];
  v_exact_columns text[] := ARRAY[
    'email_domain_verified', 'gmc_variants_enabled', 'is_platform_admin',
    'kyc_status', 'multi_currency_enabled', 'offline_conversions_enabled',
    'payout_currency', 'plan_tier', 'tax_exempt', 'vat_rate',
    'vat_registration_status'
  ];
  v_presence_columns text[] := ARRAY[
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
  ];
  v_classified_columns text[];
  v_event record;
  v_event_count integer;
BEGIN
  v_classified_columns := v_task2_owned_columns || v_exact_columns ||
    v_presence_columns;

  SELECT array_agg(column_name ORDER BY column_name)
    INTO v_live_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'merchants';

  IF (SELECT count(*) FROM unnest(v_classified_columns)) <>
       (SELECT count(DISTINCT column_name)
        FROM unnest(v_classified_columns) AS column_name)
     OR v_live_columns IS DISTINCT FROM (
       SELECT array_agg(column_name ORDER BY column_name)
       FROM unnest(v_classified_columns) AS column_name
     ) THEN
    RAISE EXCEPTION 'public.merchants Task 2/Task 4 audit classification is incomplete or overlapping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'private.audit_sensitive_merchant_configuration_change_v1()'::regprocedure
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'sensitive merchant configuration trigger wrapper must be SECURITY DEFINER';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(
      role_name,
      'private.audit_sensitive_merchant_configuration_change_v1()'::regprocedure,
      'EXECUTE'
    )
  ) THEN
    RAISE EXCEPTION 'sensitive merchant configuration wrapper is directly executable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_sensitive_merchant_configuration_change_v1'
      AND tgrelid = 'public.merchants'::regclass
      AND tgfoid = 'private.audit_sensitive_merchant_configuration_change_v1()'::regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'sensitive merchant configuration audit trigger missing';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'sensitive-merchant-audit-owner@example.com', 'test', now(),
    now(), now(), '{}'::jsonb, '{}'::jsonb
  );

  PERFORM set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (
    id, user_id, email, phone, business_name, slug, country, support_email,
    support_phone
  ) VALUES (
    v_merchant_id, v_actor_id, 'sensitive-merchant-private@example.com',
    '+2348012345678', 'Sensitive Merchant Audit', 'sensitive-merchant-audit',
    'Nigeria', 'support@sensitive-merchant.example', '+2348007654321'
  );

  SELECT count(*) INTO v_event_count
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF v_event_count <> 1
     OR v_event.action IS DISTINCT FROM 'merchant.configuration.create'
     OR v_event.actor_user_id IS DISTINCT FROM v_actor_id
     OR v_event.after_values ->> 'payout_currency' IS DISTINCT FROM 'NGN' THEN
    RAISE EXCEPTION 'merchant creation must emit one safe configuration event';
  END IF;
END;
$test$;

-- A new sensitive column must fail closed when a governed Task 4 update fires.
ALTER TABLE public.merchants
  ADD COLUMN audit_sensitive_merchant_configuration_unclassified_probe text;
ALTER TABLE public.merchants
  DISABLE TRIGGER audit_merchant_identity_schema_guard_v2;
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchants
    SET audit_sensitive_merchant_configuration_unclassified_probe =
      'sensitive-probe-direct-write'
    WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'unclassified sensitive merchant column unexpectedly bypassed audit guard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'audit_sensitive_merchant_configuration_unclassified_column' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
ALTER TABLE public.merchants
  ENABLE TRIGGER audit_merchant_identity_schema_guard_v2;
ALTER TABLE public.merchants
  DROP COLUMN audit_sensitive_merchant_configuration_unclassified_probe;
