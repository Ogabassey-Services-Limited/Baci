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
  WHERE audit_event.merchant_id = '7e3f2e40-0000-4000-8000-000000000002';
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
