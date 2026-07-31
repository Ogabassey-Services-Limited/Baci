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
