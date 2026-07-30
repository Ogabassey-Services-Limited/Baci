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
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchants
    SET payout_currency = payout_currency
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
  DROP COLUMN audit_sensitive_merchant_configuration_unclassified_probe;

-- Mobile and older clients can write merchants directly. Every field below is
-- deliberately a sentinel that must be absent from every stored audit field.
INSERT INTO audit_sensitive_event_counts
SELECT 'configured-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET bank_account_name = 'task4-bank-name-sentinel',
    bank_account_number = 'task4-bank-number-sentinel-7711',
    bank_code = 'task4-bank-code-sentinel',
    bank_name = 'task4-bank-provider-sentinel',
    bvn = 'task4-bvn-sentinel-8822',
    cac_number = 'task4-cac-number-sentinel',
    cac_rc_number = 'task4-cac-rc-sentinel',
    email_domain = 'task4-email-domain-sentinel.example',
    email_domain_verified = true,
    endpoint_id = 'task4-endpoint-sentinel',
    endpoint_scheme_id = 'task4-endpoint-scheme-sentinel',
    facebook_capi_access_token = 'task4-facebook-access-token-sentinel',
    facebook_capi_token = 'task4-facebook-token-sentinel',
    facebook_pixel_id = 'task4-facebook-pixel-sentinel',
    feature_settings = '{"secret":"task4-feature-settings-sentinel"}'::jsonb,
    firs_business_id = '7e3f2e40-0000-4000-8000-000000000003',
    firs_certificate = 'https://task4-certificate-sentinel.example/certificate.pdf',
    firs_email = 'task4-firs-email-sentinel@example.com',
    firs_password_encrypted = 'task4-firs-password-sentinel',
    firs_public_key = 'task4-firs-public-key-sentinel',
    firs_service_id = 'A1234567',
    ga4_api_secret = 'task4-analytics-token-sentinel-QWZX',
    gmc_variants_enabled = true,
    google_analytics_id = 'task4-ga-id-sentinel',
    google_product_sheet_url = 'https://task4-product-sheet-sentinel.example/feed',
    is_platform_admin = true,
    kyc_status = 'verified',
    multi_currency_enabled = false,
    nin = 'task4-nin-sentinel',
    offline_conversions_enabled = false,
    payout_currency = 'USD',
    paystack_subaccount_code = 'task4-paystack-subaccount-sentinel',
    plan_tier = 'pro',
    premium_features = '["task4-premium-feature-sentinel"]'::jsonb,
    rider_phone_number = 'task4-rider-phone-sentinel',
    snapchat_capi_token = 'task4-snapchat-token-sentinel',
    snapchat_pixel_id = 'task4-snapchat-pixel-sentinel',
    stripe_customer_id = 'task4-stripe-customer-sentinel',
    stripe_subscription_id = 'task4-stripe-subscription-sentinel',
    tax_exempt = true,
    tax_identification_number = 'task4-tin-sentinel-9933',
    tiktok_access_token = 'task4-tiktok-token-sentinel',
    tiktok_pixel_id = 'task4-tiktok-pixel-sentinel',
    twitter_pixel_id = 'task4-twitter-pixel-sentinel',
    vat_rate = 10.0,
    vat_registration_status = 'registered',
    virtual_terminal_code = 'task4-virtual-terminal-sentinel'
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
  v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_sensitive_event_counts WHERE label = 'configured-before';
  SELECT count(*) INTO v_after_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n')
    INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  IF v_after_count <> v_before_count + 1
     OR v_event.action IS DISTINCT FROM 'merchant.configuration.update'
     OR v_event.after_values ->> 'payout_currency' IS DISTINCT FROM 'USD'
     OR v_event.after_values ->> 'kyc_status' IS DISTINCT FROM 'verified'
     OR v_event.after_values ->> 'tax_exempt' IS DISTINCT FROM 'true'
     OR COALESCE((v_event.after_values ->> 'vat_rate')::numeric, -1) IS DISTINCT FROM 10.0
     OR v_event.after_values ->> 'vat_registration_status' IS DISTINCT FROM 'registered'
     OR v_event.after_values -> 'cac_number' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'cac_rc_number' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     -- The current merchant schema assigns an endpoint scheme during creation,
     -- so replacing it in this update must retain a rotated lifecycle state.
     OR v_event.after_values -> 'endpoint_scheme_id' IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR v_event.after_values -> 'paystack_subaccount_code' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'ga4_api_secret' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'tax_identification_number' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR NOT (v_event.changed_fields @> ARRAY[
       'bank_account_number', 'bvn', 'cac_rc_number', 'firs_certificate',
       'firs_password_encrypted', 'nin', 'paystack_subaccount_code',
       'tax_identification_number', 'ga4_api_secret'
     ]::text[])
     OR position('task4-' in coalesce(v_audit_text, '')) > 0
     OR position('A1234567' in coalesce(v_event.after_values::text, '')) > 0
     OR position('7711' in coalesce(v_event.after_values::text, '')) > 0
     OR position('8822' in coalesce(v_event.after_values::text, '')) > 0
     OR position('9933' in coalesce(v_event.after_values::text, '')) > 0
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.jsonb_each(v_event.after_values) AS value(field_name, field_value)
       WHERE field_name = ANY (ARRAY[
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
       ]::text[])
         AND field_name <> 'endpoint_scheme_id'
         AND field_value IS DISTINCT FROM
           '{"present":true,"state":"configured"}'::jsonb
     ) THEN
    RAISE EXCEPTION 'sensitive merchant configuration update leaked a sentinel or omitted useful redacted evidence';
  END IF;
END;
$test$;

-- A token rotation remains useful (and distinguishable from configuration)
-- without retaining either the prior or the replacement secret.
INSERT INTO audit_sensitive_event_counts
SELECT 'rotated-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET ga4_api_secret = 'task4-analytics-rotated-sentinel-RSTV'
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_sensitive_event_counts WHERE label = 'rotated-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';
  IF v_after_count <> v_before_count + 1
     OR v_event.after_values -> 'ga4_api_secret' IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR position('task4-analytics-token-sentinel-QWZX' in coalesce(v_audit_text, '')) > 0
     OR position('task4-analytics-rotated-sentinel-RSTV' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'analytics rotation was not safely represented';
  END IF;
END;
$test$;

-- A clear has a distinct state and still persists no raw secret.
INSERT INTO audit_sensitive_event_counts
SELECT 'cleared-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET ga4_api_secret = NULL
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
  v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_sensitive_event_counts WHERE label = 'cleared-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n')
    INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE audit_event.id = v_event.id;
  IF v_after_count <> v_before_count + 1
     OR v_event.after_values -> 'ga4_api_secret' IS DISTINCT FROM
       '{"present":false,"state":"cleared"}'::jsonb THEN
    RAISE EXCEPTION 'analytics clear was not safely represented';
  END IF;
  PERFORM pg_temp.assert_task4_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value
      FROM audit_sensitive_redaction_sentinels
      WHERE lifecycle = 'clear'
      ORDER BY value
    ),
    'analytics clear'
  );
END;
$test$;

-- The real KYC RPCs write merchants internally. Their sensitive updates must
-- still become redacted audit events without route-supplied audit metadata.
INSERT INTO audit_sensitive_event_counts
SELECT 'nin-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
SELECT public.record_nin_verification(
  '7e3f2e40-0000-4000-8000-000000000002', 'task4-nin-rpc-sentinel',
  'Audit', 'Owner', '1990-01-01'::date
);
SELECT public.record_bvn_verification(
  '7e3f2e40-0000-4000-8000-000000000002', 'task4-bvn-rpc-sentinel',
  'Audit', 'Owner', '1990-01-01'::date
);
RESET ROLE;

DO $test$
DECLARE v_new_events record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_sensitive_event_counts WHERE label = 'nin-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';
  SELECT * INTO v_new_events FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 2
     OR NOT (v_new_events.changed_fields && ARRAY['nin', 'bvn']::text[])
     OR v_new_events.after_values -> 'bvn' IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR NOT EXISTS (
       SELECT 1
       FROM public.audit_events AS audit_event
       WHERE audit_event.merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
         AND audit_event.metadata ->> 'category' = 'merchant_configuration'
         AND audit_event.after_values -> 'nin' =
           '{"present":true,"state":"rotated"}'::jsonb
     )
     OR position('task4-nin-rpc-sentinel' in coalesce(v_audit_text, '')) > 0
     OR position('task4-bvn-rpc-sentinel' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'NIN/BVN verification RPCs did not emit safely redacted events';
  END IF;
END;
$test$;

-- A CAC verification is one logical merchant update that spans the Task 2
-- public-identity allowlist and Task 4 sensitive allowlist. It must yield
-- precisely two events that share a writer-generated transaction identifier.
DO $test$
DECLARE
  v_before_ids uuid[];
  v_new_event_count integer;
  v_new_transaction_count integer;
  v_identity_count integer;
  v_configuration_count integer;
  v_configuration_cac_state jsonb;
  v_audit_text text;
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
    INTO v_before_ids
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
  PERFORM public.record_cac_verification(
    '7e3f2e40-0000-4000-8000-000000000002',
    'https://task4-certificate-sentinel.example/cac.pdf',
    'Sensitive Merchant Audit Limited',
    'task4-cac-rpc-sentinel'
  );
  RESET ROLE;

  SELECT count(*), count(DISTINCT database_transaction_id),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_identity'),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_configuration')
    INTO v_new_event_count, v_new_transaction_count, v_identity_count,
         v_configuration_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids);
  SELECT after_values -> 'cac_rc_number'
    INTO v_configuration_cac_state
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids)
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  IF v_new_event_count <> 2
     OR v_new_transaction_count <> 1
     OR v_identity_count <> 1
     OR v_configuration_count <> 1
     OR v_configuration_cac_state IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR position('task4-cac-rpc-sentinel' in coalesce(v_audit_text, '')) > 0
     OR position('task4-certificate-sentinel' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'CAC verification did not yield exactly two safely grouped cross-domain events';
  END IF;
END;
$test$;

-- Direct changes spanning a public Task 2 field and a Task 4 field likewise
-- remain one event per domain and share the database transaction identifier.
DO $test$
DECLARE
  v_before_ids uuid[];
  v_new_event_count integer;
  v_new_transaction_count integer;
  v_identity_count integer;
  v_configuration_count integer;
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
    INTO v_before_ids
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
  UPDATE public.merchants
  SET site_title = 'Task 4 cross-domain title', payout_currency = 'EUR'
  WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
  RESET ROLE;

  SELECT count(*), count(DISTINCT database_transaction_id),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_identity'),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_configuration')
    INTO v_new_event_count, v_new_transaction_count, v_identity_count,
         v_configuration_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids);

  IF v_new_event_count <> 2
     OR v_new_transaction_count <> 1
     OR v_identity_count <> 1
     OR v_configuration_count <> 1 THEN
    RAISE EXCEPTION 'cross-domain merchant update did not yield exactly two grouped events';
  END IF;
END;
$test$;

-- Sensitive merchant creation and deletion retain only usable state across
-- bank, tax/KYC, FIRS, certificate, and analytics lifecycle data.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '7e3f2e40-0000-4000-8000-000000000005',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'sensitive-merchant-delete-owner@example.com', 'test', now(), now(), now(),
  '{}'::jsonb, '{}'::jsonb
);

INSERT INTO public.merchants (
  id, user_id, email, phone, business_name, slug, country, support_email,
  support_phone, bank_account_name, bank_account_number, bank_code, bank_name,
  bvn, cac_number, cac_rc_number, facebook_capi_access_token,
  facebook_capi_token, facebook_pixel_id, feature_settings, firs_certificate,
  firs_password_encrypted, firs_public_key, firs_service_id, ga4_api_secret,
  google_analytics_id, google_product_sheet_url, kyc_status, nin,
  paystack_subaccount_code, premium_features, snapchat_capi_token,
  snapchat_pixel_id, tax_exempt, tax_identification_number,
  tiktok_access_token, tiktok_pixel_id, twitter_pixel_id, vat_rate,
  vat_registration_status
) VALUES (
  '7e3f2e40-0000-4000-8000-000000000004',
  '7e3f2e40-0000-4000-8000-000000000005',
  'sensitive-merchant-delete@example.com', '+2348012345679',
  'Sensitive Merchant Delete Audit', 'sensitive-merchant-delete-audit',
  'Nigeria', 'support-delete@sensitive-merchant.example', '+2348007654322',
  'task4-delete-bank-account-name-sentinel-QWZX',
  'task4-delete-bank-number-sentinel-RSTV',
  'task4-delete-bank-code-sentinel-WXQR',
  'task4-delete-bank-provider-sentinel-ZTVW',
  'task4-delete-bvn-sentinel-QXWZ',
  'task4-delete-cac-number-sentinel-RVWX',
  'task4-delete-cac-rc-sentinel-ZQRT',
  'task4-delete-facebook-token-sentinel-WZQR',
  'task4-delete-facebook-capi-token-sentinel-XWZR',
  'task4-delete-facebook-pixel-sentinel-QVWX',
  '{"secret":"task4-delete-feature-settings-sentinel-ZQWX"}'::jsonb,
  'https://task4-delete-certificate-sentinel.example/certificate-WXYZ',
  'task4-delete-firs-password-sentinel-QRTV',
  'task4-delete-firs-public-key-sentinel-WXZY',
  'FIRSQWZX',
  'task4-delete-analytics-secret-sentinel-QXTV',
  'task4-delete-google-analytics-sentinel-XQTR',
  'https://task4-delete-product-sheet-sentinel.example/feed-WXQZ',
  'verified', 'task4-delete-nin-sentinel-QVRX',
  'task4-delete-paystack-subaccount-sentinel-RXWQ',
  '["task4-delete-premium-feature-sentinel-VWXR"]'::jsonb,
  'task4-delete-snapchat-token-sentinel-RTWX',
  'task4-delete-snapchat-pixel-sentinel-ZTRW', true,
  'task4-delete-tin-sentinel-TWZX',
  'task4-delete-tiktok-token-sentinel-VZQW',
  'task4-delete-tiktok-pixel-sentinel-WXVT',
  'task4-delete-twitter-pixel-sentinel-QZRW', 7.5, 'registered'
);

DO $test$
DECLARE v_event record; v_audit_text text;
BEGIN
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000004'
    AND action = 'merchant.configuration.create'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000004';

  IF v_event.action IS DISTINCT FROM 'merchant.configuration.create'
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e40-0000-4000-8000-000000000001'
     OR v_event.after_values -> 'bank_account_number' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'firs_certificate' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'firs_password_encrypted' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'ga4_api_secret' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'nin' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'tax_identification_number' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values ->> 'kyc_status' IS DISTINCT FROM 'verified'
     OR v_event.after_values ->> 'tax_exempt' IS DISTINCT FROM 'true'
     OR COALESCE((v_event.after_values ->> 'vat_rate')::numeric, -1) IS DISTINCT FROM 7.5
     OR v_event.after_values ->> 'vat_registration_status' IS DISTINCT FROM 'registered'
     OR position('task4-delete-' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'sensitive merchant creation leaked a sentinel or omitted useful evidence';
  END IF;
  PERFORM pg_temp.assert_task4_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value
      FROM audit_sensitive_redaction_sentinels
      WHERE lifecycle = 'create_delete'
      ORDER BY value
    ),
    'sensitive merchant creation'
  );
END;
$test$;

-- The deletion must execute as this merchant's distinct owner so final RLS
-- policy and audit attribution agree.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000005', true);
SELECT set_config('app.audit_actor_user_id', '7e3f2e40-0000-4000-8000-000000000005', true);
DELETE FROM public.merchants
WHERE id = '7e3f2e40-0000-4000-8000-000000000004';
RESET ROLE;
SELECT set_config('app.audit_actor_user_id', '7e3f2e40-0000-4000-8000-000000000001', true);

DO $test$
DECLARE v_event record; v_audit_text text;
BEGIN
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000004'
    AND action = 'merchant.configuration.delete'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000004';

  IF v_event.action IS DISTINCT FROM 'merchant.configuration.delete'
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e40-0000-4000-8000-000000000005'
     OR v_event.before_values -> 'bank_account_number' IS DISTINCT FROM
       '{"present":true}'::jsonb
     OR v_event.before_values -> 'firs_certificate' IS DISTINCT FROM
       '{"present":true}'::jsonb
     OR v_event.before_values -> 'firs_password_encrypted' IS DISTINCT FROM
       '{"present":true}'::jsonb
     OR v_event.before_values -> 'ga4_api_secret' IS DISTINCT FROM
       '{"present":true}'::jsonb
     OR v_event.before_values -> 'nin' IS DISTINCT FROM '{"present":true}'::jsonb
     OR v_event.before_values -> 'tax_identification_number' IS DISTINCT FROM
       '{"present":true}'::jsonb
     OR v_event.before_values ->> 'kyc_status' IS DISTINCT FROM 'verified'
     OR v_event.before_values ->> 'tax_exempt' IS DISTINCT FROM 'true'
     OR COALESCE((v_event.before_values ->> 'vat_rate')::numeric, -1) IS DISTINCT FROM 7.5
     OR v_event.before_values ->> 'vat_registration_status' IS DISTINCT FROM 'registered'
     OR position('task4-delete-' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'sensitive merchant deletion leaked a sentinel or omitted useful evidence';
  END IF;
  PERFORM pg_temp.assert_task4_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value
      FROM audit_sensitive_redaction_sentinels
      WHERE lifecycle = 'create_delete'
      ORDER BY value
    ),
    'sensitive merchant deletion'
  );
END;
$test$;

-- Timestamp-only and no-op writes must not add configuration evidence.
INSERT INTO audit_sensitive_event_counts
SELECT 'noop-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET payout_currency = payout_currency
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
UPDATE public.merchants
SET updated_at = updated_at + interval '1 microsecond'
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_sensitive_event_counts WHERE label = 'noop-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  IF v_after_count <> v_before_count THEN
    RAISE EXCEPTION 'sensitive configuration no-op or updated_at-only write emitted an event';
  END IF;
END;
$test$;

-- Audit writes roll back atomically with a sensitive configuration mutation.
SAVEPOINT audit_sensitive_merchant_configuration_rollback;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET payout_currency = 'GBP'
WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
RESET ROLE;
ROLLBACK TO SAVEPOINT audit_sensitive_merchant_configuration_rollback;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE id = '7e3f2e40-0000-4000-8000-000000000002'
      AND payout_currency = 'GBP'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
      AND after_values ->> 'payout_currency' = 'GBP'
  ) THEN
    RAISE EXCEPTION 'rolled-back sensitive merchant mutation leaked state or audit evidence';
  END IF;
END;
$test$;

ROLLBACK;
