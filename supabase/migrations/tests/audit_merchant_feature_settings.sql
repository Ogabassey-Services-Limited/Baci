-- Regression contract for 20260730000400_audit_merchant_feature_settings.sql.
-- This fixture runs after every pending migration and rolls back all rows.

BEGIN;

CREATE TEMP TABLE audit_merchant_feature_settings_counts (
  label text PRIMARY KEY,
  event_count integer NOT NULL
);

CREATE TEMP TABLE audit_merchant_feature_settings_sentinels (
  lifecycle text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (lifecycle, value)
);

CREATE FUNCTION pg_temp.assert_task5_redacted_audit_rows(
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
    RAISE EXCEPTION '% redaction assertion did not receive sentinel corpus',
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
    PERFORM pg_temp.assert_task5_redacted_audit_rows(
      '{"event":"task5-empty-sentinel-corpus"}',
      ARRAY[]::text[],
      'empty sentinel corpus'
    );
    RAISE EXCEPTION 'redaction assertion unexpectedly accepted an empty sentinel corpus';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM IS DISTINCT FROM
      'empty sentinel corpus redaction assertion did not receive sentinel corpus' THEN
      RAISE;
    END IF;
  END;
END;
$test$;

INSERT INTO audit_merchant_feature_settings_sentinels (lifecycle, value) VALUES
  ('create', 'task5-credit-direct-public-key-sentinel-QWZX'),
  ('create', 'task5-facebook-capi-sentinel-RSTV'),
  ('create', 'task5-ga4-secret-sentinel-XQWZ'),
  ('create', 'task5-custom-settings-secret-sentinel-QWZX'),
  ('create', 'task5-nested-secret-fragment-RSTV'),
  ('create', 'task5-suffix-q7w9'),
  ('create', 'task5-repair-contact-sentinel-WXQR'),
  ('create', 'task5-provider-secret-sentinel-ZTVW'),
  ('rotation', 'task5-credit-direct-public-key-rotated-RSTV'),
  ('rotation', 'task5-facebook-capi-wide-rotated-VWXY'),
  ('rotation', 'task5-ga4-secret-rotated-QWZX'),
  ('rotation', 'task5-custom-settings-secret-rotated-XQTR'),
  ('clear', 'task5-credit-direct-public-key-rotated-RSTV'),
  ('clear', 'task5-ga4-secret-rotated-QWZX'),
  ('clear', 'task5-custom-settings-secret-rotated-XQTR'),
  ('delete', 'task5-credit-direct-public-key-delete-WXQR'),
  ('delete', 'task5-facebook-capi-delete-ZTVW'),
  ('delete', 'task5-ga4-secret-delete-QXWZ'),
  ('delete', 'task5-custom-settings-secret-delete-RSTV'),
  ('delete', 'task5-nested-secret-delete-QWZX');

DO $test$
DECLARE
  v_actor_id uuid := '7e3f2e50-0000-4000-8000-000000000001';
  v_primary_merchant_id uuid := '7e3f2e50-0000-4000-8000-000000000002';
  v_manual_owner_id uuid := '7e3f2e50-0000-4000-8000-000000000003';
  v_manual_merchant_id uuid := '7e3f2e50-0000-4000-8000-000000000004';
  v_target_owner_id uuid := '7e3f2e50-0000-4000-8000-000000000005';
  v_target_merchant_id uuid := '7e3f2e50-0000-4000-8000-000000000006';
  v_primary_settings_id uuid;
  v_live_columns text[];
  v_exact_columns text[] := ARRAY[
    'about_page_enabled', 'agentic_checkout_enabled', 'auto_blog_enabled',
    'auto_generate_schema', 'blog_discover_image_validation_enabled',
    'blog_enabled', 'checkout_collect_phone', 'checkout_require_account',
    'checkout_show_order_notes', 'contact_page_enabled', 'credit_direct_enabled',
    'credit_direct_max_amount', 'credit_direct_min_amount', 'credpal_enabled',
    'customer_device_savings_auto_debit_enabled',
    'customer_device_savings_break_fee_enabled',
    'customer_device_savings_enabled', 'discount_codes_enabled',
    'email_notifications_enabled', 'faq_page_enabled', 'free_shipping_threshold',
    'google_reviews_enabled', 'guest_checkout_enabled', 'juicyway_enabled',
    'klump_enabled', 'klump_max_amount', 'klump_min_amount', 'korapay_enabled',
    'low_stock_threshold', 'loyalty_enabled', 'order_tracking_enabled',
    'pay_on_delivery_enabled', 'paystack_enabled',
    'preferred_international_gateway', 'preferred_local_gateway',
    'privacy_page_enabled', 'repairs_catalog_enabled', 'reviews_enabled',
    'rewards_page_enabled', 'shipping_insurance_enabled',
    'shipping_insurance_min_order_value', 'shipping_insurance_opt_in_default',
    'shipping_markup_percentage', 'show_recent_purchases', 'show_stock_levels',
    'sms_notifications_enabled', 'terms_page_enabled', 'vtu_airtime_enabled',
    'vtu_betting_enabled', 'vtu_checkout_addon_amounts',
    'vtu_checkout_addon_enabled', 'vtu_customer_cashback_enabled',
    'vtu_customer_cashback_rate', 'vtu_data_enabled', 'vtu_electricity_enabled',
    'vtu_enabled', 'vtu_loyalty_reward_enabled', 'vtu_merchant_commission_rate',
    'vtu_tv_enabled', 'wallet_order_auto_debit_enabled',
    'wallet_paystack_dva_enabled', 'wishlist_enabled'
  ];
  v_presence_columns text[] := ARRAY[
    'credit_direct_public_key', 'custom_settings', 'facebook_capi_token',
    'facebook_pixel_id', 'ga4_api_secret', 'google_analytics_id',
    'google_place_id', 'repair_settings', 'shipping_providers',
    'snapchat_capi_token', 'snapchat_pixel_id', 'tiktok_access_token',
    'tiktok_pixel_id', 'twitter_pixel_id'
  ];
  v_ignored_columns text[] := ARRAY[
    'created_at', 'custom_robots_txt', 'updated_at'
  ];
  v_forbidden_columns text[] := ARRAY['id', 'merchant_id'];
  v_classified_columns text[];
  v_event record;
  v_event_found boolean;
  v_after_value_keys text[];
BEGIN
  v_classified_columns := v_exact_columns || v_presence_columns ||
    v_ignored_columns || v_forbidden_columns;

  SELECT array_agg(column_name ORDER BY column_name)
    INTO v_live_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'merchant_feature_settings';

  IF (SELECT count(*) FROM unnest(v_classified_columns)) <>
       (SELECT count(DISTINCT column_name)
        FROM unnest(v_classified_columns) AS column_name)
     OR v_live_columns IS DISTINCT FROM (
       SELECT array_agg(column_name ORDER BY column_name)
       FROM unnest(v_classified_columns) AS column_name
     ) THEN
    RAISE EXCEPTION 'public.merchant_feature_settings Task 5 audit classification is incomplete or overlapping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'private.audit_merchant_feature_settings_change_v1()'::regprocedure
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'merchant feature settings trigger wrapper must be SECURITY DEFINER';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(
      role_name,
      'private.audit_merchant_feature_settings_change_v1()'::regprocedure,
      'EXECUTE'
    )
  ) THEN
    RAISE EXCEPTION 'merchant feature settings wrapper is directly executable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_merchant_feature_settings_change_v1'
      AND tgrelid = 'public.merchant_feature_settings'::regclass
      AND tgfoid = 'private.audit_merchant_feature_settings_change_v1()'::regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'merchant feature settings audit trigger missing';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES
    (v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'task5-primary-owner@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_manual_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'task5-manual-owner@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_target_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'task5-target-owner@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb);

  PERFORM pg_catalog.set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (
    id, user_id, email, phone, business_name, slug, country, support_email,
    support_phone
  ) VALUES
    (v_primary_merchant_id, v_actor_id, 'task5-primary@example.com',
      '+2348010101001', 'Task 5 Primary Store', 'task5-primary-store', 'Nigeria',
      'support-task5-primary@example.com', '+2348010101002'),
    (v_manual_merchant_id, v_manual_owner_id, 'task5-manual@example.com',
      '+2348010101003', 'Task 5 Manual Store', 'task5-manual-store', 'Nigeria',
      'support-task5-manual@example.com', '+2348010101004'),
    (v_target_merchant_id, v_target_owner_id, 'task5-target@example.com',
      '+2348010101005', 'Task 5 Target Store', 'task5-target-store', 'Nigeria',
      'support-task5-target@example.com', '+2348010101006');

  SELECT id INTO v_primary_settings_id
  FROM public.merchant_feature_settings
  WHERE merchant_id = v_primary_merchant_id;
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_primary_merchant_id
    AND metadata ->> 'category' = 'merchant_feature_settings'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  v_event_found := FOUND;
  SELECT array_agg(key ORDER BY key) INTO v_after_value_keys
  FROM pg_catalog.jsonb_object_keys(v_event.after_values) AS key;
  IF NOT v_event_found
     OR v_event.action IS DISTINCT FROM 'merchant.feature_settings.create'
     OR v_event.actor_user_id IS DISTINCT FROM v_actor_id
     OR v_event.resource_type IS DISTINCT FROM 'merchant_feature_settings'
     OR v_event.resource_id IS DISTINCT FROM v_primary_settings_id::text
     OR v_event.changed_fields IS DISTINCT FROM ARRAY['settings_snapshot']::text[]
     OR v_event.before_values IS NOT NULL
     OR v_after_value_keys IS DISTINCT FROM ARRAY['credentials', 'settings']::text[]
     OR v_event.metadata ->> 'operation' IS DISTINCT FROM 'insert'
     OR v_event.after_values -> 'settings' ->> 'paystack_enabled' IS DISTINCT FROM 'true'
     OR v_event.after_values -> 'settings' ->> 'korapay_enabled' IS DISTINCT FROM 'false'
     OR COALESCE((v_event.after_values -> 'settings' ->> 'credit_direct_min_amount')::numeric, -1)
        IS DISTINCT FROM 10000 THEN
    RAISE EXCEPTION 'merchant creation must emit one safe feature settings snapshot';
  END IF;
END;
$test$;

-- New columns must fail closed for a direct update, rather than only when an
-- unrelated known column happens to be written alongside them.
ALTER TABLE public.merchant_feature_settings
  ADD COLUMN audit_merchant_feature_settings_unclassified_probe text;
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchant_feature_settings
    SET audit_merchant_feature_settings_unclassified_probe = 'task5-unclassified'
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'unclassified feature setting unexpectedly bypassed audit guard';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM IS DISTINCT FROM 'audit_merchant_feature_settings_unclassified_column' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
ALTER TABLE public.merchant_feature_settings
  DROP COLUMN audit_merchant_feature_settings_unclassified_probe;

-- The web API, dashboard, and older/mobile clients all reduce to an ordinary
-- authenticated row update. Preserve safe gateway and checkout values while
-- redacting every credential and nested custom setting.
-- The automatic settings row above needs a database principal. Clear it before
-- client-shaped writes so their actor evidence must come from the JWT subject.
SELECT pg_catalog.set_config('app.audit_actor_user_id', '', true);
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'primary-update-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'role', 'authenticated',
    'sub', '7e3f2e50-0000-4000-8000-000000000001'
  )::text,
  true
);
UPDATE public.merchant_feature_settings
SET paystack_enabled = false,
    korapay_enabled = true,
    credit_direct_enabled = true,
    credpal_enabled = true,
    juicyway_enabled = true,
    pay_on_delivery_enabled = false,
    preferred_local_gateway = 'korapay',
    preferred_international_gateway = 'paystack',
    checkout_collect_phone = false,
    checkout_require_account = true,
    checkout_show_order_notes = false,
    credit_direct_min_amount = 20000,
    credit_direct_max_amount = 250000,
    klump_enabled = true,
    klump_min_amount = 15000,
    klump_max_amount = 350000,
    free_shipping_threshold = 5000,
    shipping_providers = '["gigl", "task5-provider-secret-sentinel-ZTVW"]'::jsonb,
    vtu_checkout_addon_amounts = ARRAY[200, 500, 1000],
    credit_direct_public_key = 'task5-credit-direct-public-key-sentinel-QWZX',
    facebook_capi_token = 'task5-facebook-capi-sentinel-RSTV',
    ga4_api_secret = 'task5-ga4-secret-sentinel-XQWZ',
    repair_settings = pg_catalog.jsonb_build_object(
      'contact_phone', 'task5-repair-contact-sentinel-WXQR'
    ),
    custom_settings = pg_catalog.jsonb_build_object(
      'google_store_widget_enabled', true,
      'zohoCampaigns', pg_catalog.jsonb_build_object(
        'refreshToken', 'task5-custom-settings-secret-sentinel-QWZX',
        'nested', pg_catalog.jsonb_build_object(
          'token', 'task5-nested-secret-fragment-RSTV'
        )
      ),
      'task5-secret-key', 'task5-suffix-q7w9'
    )
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
  v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_merchant_feature_settings_counts WHERE label = 'primary-update-before';
  SELECT count(*) INTO v_after_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n')
    INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';

  IF v_after_count IS DISTINCT FROM v_before_count + 1
     OR v_event.action IS DISTINCT FROM 'merchant.feature_settings.update'
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e50-0000-4000-8000-000000000001'::uuid
     OR v_event.after_values ->> 'paystack_enabled' IS DISTINCT FROM 'false'
     OR v_event.after_values ->> 'korapay_enabled' IS DISTINCT FROM 'true'
     OR v_event.after_values ->> 'credit_direct_enabled' IS DISTINCT FROM 'true'
     OR v_event.after_values ->> 'credpal_enabled' IS DISTINCT FROM 'true'
     OR v_event.after_values ->> 'juicyway_enabled' IS DISTINCT FROM 'true'
     OR v_event.after_values ->> 'preferred_local_gateway' IS DISTINCT FROM 'korapay'
     OR v_event.after_values ->> 'preferred_international_gateway' IS DISTINCT FROM 'paystack'
     OR v_event.after_values ->> 'checkout_collect_phone' IS DISTINCT FROM 'false'
     OR COALESCE((v_event.after_values ->> 'credit_direct_min_amount')::numeric, -1)
        IS DISTINCT FROM 20000
     OR COALESCE((v_event.after_values ->> 'credit_direct_max_amount')::numeric, -1)
        IS DISTINCT FROM 250000
     OR v_event.after_values -> 'vtu_checkout_addon_amounts'
        IS DISTINCT FROM '[200,500,1000]'::jsonb
     OR v_event.after_values -> 'credit_direct_public_key'
        IS DISTINCT FROM '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'ga4_api_secret'
        IS DISTINCT FROM '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'custom_settings'
        IS DISTINCT FROM '{"present":true,"state":"configured","changed_safe_keys":["google_store_widget_enabled"]}'::jsonb
     OR NOT (v_event.changed_fields @> ARRAY[
       'paystack_enabled', 'korapay_enabled', 'credit_direct_enabled',
       'credpal_enabled', 'juicyway_enabled', 'preferred_local_gateway',
       'checkout_collect_phone', 'credit_direct_min_amount',
       'credit_direct_max_amount', 'credit_direct_public_key',
       'ga4_api_secret', 'custom_settings', 'shipping_providers'
     ]::text[])
     OR v_event.database_transaction_id IS NULL THEN
    RAISE EXCEPTION 'feature settings update omitted safe evidence or actor attribution';
  END IF;

  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle = 'create' ORDER BY value
    ),
    'primary update'
  );
END;
$test$;

-- The current API schema and table domain accept negative threshold values.
-- They are safe numeric configuration, so the audit record must retain the
-- exact before/after values instead of collapsing valid writes to a marker.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'negative-threshold-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'role', 'authenticated',
    'sub', '7e3f2e50-0000-4000-8000-000000000001'
  )::text,
  true
);
UPDATE public.merchant_feature_settings
SET free_shipping_threshold = -1,
    low_stock_threshold = -5
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_merchant_feature_settings_counts
  WHERE label = 'negative-threshold-before';
  SELECT count(*) INTO v_after_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;

  IF v_after_count IS DISTINCT FROM v_before_count + 1
     OR (v_event.before_values ->> 'free_shipping_threshold')::numeric
        IS DISTINCT FROM 5000
     OR (v_event.after_values ->> 'free_shipping_threshold')::numeric
        IS DISTINCT FROM -1
     OR (v_event.before_values ->> 'low_stock_threshold')::integer
        IS DISTINCT FROM 10
     OR (v_event.after_values ->> 'low_stock_threshold')::integer
        IS DISTINCT FROM -5 THEN
    RAISE EXCEPTION 'negative threshold values lost exact audit evidence';
  END IF;
END;
$test$;

-- Rotating a secret still produces a useful state transition without exposing
-- either version or arbitrary top-level custom-setting keys.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'primary-rotation-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000001')::text,
  true
);
UPDATE public.merchant_feature_settings
SET credit_direct_public_key = 'task5-credit-direct-public-key-rotated-RSTV',
    ga4_api_secret = 'task5-ga4-secret-rotated-QWZX',
    custom_settings = pg_catalog.jsonb_build_object(
      'google_store_widget_enabled', true,
      'zohoCampaigns', pg_catalog.jsonb_build_object(
        'refreshToken', 'task5-custom-settings-secret-rotated-XQTR'
      )
    )
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_merchant_feature_settings_counts
  WHERE label = 'primary-rotation-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  IF v_after_count IS DISTINCT FROM v_before_count + 1
     OR v_event.after_values -> 'credit_direct_public_key'
        IS DISTINCT FROM '{"present":true,"state":"rotated"}'::jsonb
     OR v_event.after_values -> 'ga4_api_secret'
        IS DISTINCT FROM '{"present":true,"state":"rotated"}'::jsonb
     OR v_event.after_values -> 'custom_settings'
        IS DISTINCT FROM '{"present":true,"state":"rotated","changed_safe_keys":[]}'::jsonb THEN
    RAISE EXCEPTION 'credential rotation was not safely represented';
  END IF;
  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle IN ('create', 'rotation') ORDER BY value
    ),
    'primary rotation'
  );
END;
$test$;

-- A wide client PUT must retain accurate credential baselines: changed
-- credentials get a transition, while unchanged credentials stay presence-only.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'wide-update-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000001')::text,
  true
);
DO $test$
DECLARE
  v_assignments text;
  v_assignment_count integer;
  v_unsupported_count integer;
BEGIN
  WITH exact_columns AS (
    SELECT column_name, data_type, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchant_feature_settings'
      AND column_name NOT IN (
        'id', 'merchant_id', 'created_at', 'custom_robots_txt', 'updated_at',
        'credit_direct_public_key', 'custom_settings', 'facebook_capi_token',
        'facebook_pixel_id', 'ga4_api_secret', 'google_analytics_id',
        'google_place_id', 'repair_settings', 'shipping_providers',
        'snapchat_capi_token', 'snapchat_pixel_id', 'tiktok_access_token',
        'tiktok_pixel_id', 'twitter_pixel_id'
      )
  ), assignments AS (
    SELECT
      ordinal_position,
      CASE
        WHEN column_name IN (
          'preferred_international_gateway', 'preferred_local_gateway'
        ) THEN format(
          '%I = CASE WHEN %I = %L THEN %L ELSE %L END',
          column_name, column_name, 'paystack', 'korapay', 'paystack'
        )
        WHEN column_name = 'vtu_checkout_addon_amounts' THEN
          format('%I = ARRAY[321, 654]::integer[]', column_name)
        WHEN data_type = 'boolean' THEN
          format('%I = NOT COALESCE(%I, false)', column_name, column_name)
        WHEN data_type IN (
          'bigint', 'integer', 'numeric', 'real', 'smallint', 'double precision'
        ) THEN format('%I = COALESCE(%I, 0) + 1', column_name, column_name)
      END AS assignment
    FROM exact_columns
  )
  SELECT
    string_agg(assignment, ', ' ORDER BY ordinal_position),
    count(*),
    count(*) FILTER (WHERE assignment IS NULL)
  INTO v_assignments, v_assignment_count, v_unsupported_count
  FROM assignments;

  IF v_assignment_count IS DISTINCT FROM 62
     OR v_unsupported_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'wide feature settings fixture no longer covers every exact field';
  END IF;

  v_assignments := v_assignments || format(
    ', facebook_capi_token = %L', 'task5-facebook-capi-wide-rotated-VWXY'
  );
  EXECUTE format(
    'UPDATE public.merchant_feature_settings SET %s WHERE merchant_id = %L',
    v_assignments,
    '7e3f2e50-0000-4000-8000-000000000002'
  );
END;
$test$;
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_merchant_feature_settings_counts
  WHERE label = 'wide-update-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings'
    AND action = 'merchant.feature_settings.update'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  IF v_after_count IS DISTINCT FROM v_before_count + 1
     OR v_event.changed_fields IS DISTINCT FROM ARRAY['settings_snapshot']::text[]
     OR v_event.before_values -> 'credentials' -> 'credit_direct_public_key'
        IS DISTINCT FROM '{"present":true}'::jsonb
     OR v_event.after_values -> 'credentials' -> 'credit_direct_public_key'
        IS DISTINCT FROM '{"present":true}'::jsonb
     OR v_event.after_values -> 'credentials' -> 'facebook_capi_token'
        IS DISTINCT FROM '{"present":true,"state":"rotated"}'::jsonb
     OR v_event.after_values -> 'credentials' -> 'custom_settings'
        IS DISTINCT FROM '{"present":true}'::jsonb THEN
    RAISE EXCEPTION 'wide feature settings update misrepresented credential baselines';
  END IF;
  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle IN ('create', 'rotation') ORDER BY value
    ),
    'wide update'
  );
END;
$test$;

-- A clear is distinct from a rotation and must also scan the complete stored
-- audit row, including the old values that contain credential state.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'primary-clear-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000001')::text,
  true
);
UPDATE public.merchant_feature_settings
SET credit_direct_public_key = NULL,
    ga4_api_secret = NULL,
    custom_settings = '{}'::jsonb
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_merchant_feature_settings_counts
  WHERE label = 'primary-clear-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  IF v_after_count IS DISTINCT FROM v_before_count + 1
     OR v_event.after_values -> 'credit_direct_public_key'
        IS DISTINCT FROM '{"present":false,"state":"cleared"}'::jsonb
     OR v_event.after_values -> 'ga4_api_secret'
        IS DISTINCT FROM '{"present":false,"state":"cleared"}'::jsonb
     OR v_event.after_values -> 'custom_settings'
        IS DISTINCT FROM '{"present":false,"state":"cleared","changed_safe_keys":[]}'::jsonb THEN
    RAISE EXCEPTION 'credential clear was not safely represented';
  END IF;
  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle IN ('create', 'rotation', 'clear') ORDER BY value
    ),
    'primary clear'
  );
END;
$test$;

-- A semantic no-op and an updated_at-only write must not produce events.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'no-op-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000001')::text,
  true
);
UPDATE public.merchant_feature_settings
SET paystack_enabled = paystack_enabled
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
UPDATE public.merchant_feature_settings
SET updated_at = updated_at + interval '1 second'
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
UPDATE public.merchant_feature_settings
SET custom_robots_txt = 'User-agent: *\nDisallow: /task5-ignored'
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;
DO $test$
BEGIN
  IF (
    SELECT count(*) FROM public.audit_events
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
      AND metadata ->> 'category' = 'merchant_feature_settings'
  ) IS DISTINCT FROM (
    SELECT event_count FROM audit_merchant_feature_settings_counts
    WHERE label = 'no-op-before'
  ) THEN
    RAISE EXCEPTION 'semantic no-op or updated_at-only feature settings write emitted an audit event';
  END IF;
END;
$test$;

-- An audited mutation that rolls back must not leave a committed audit row.
INSERT INTO audit_merchant_feature_settings_counts
SELECT 'rollback-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_feature_settings';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000001', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000001')::text,
  true
);
SAVEPOINT task5_rollback;
UPDATE public.merchant_feature_settings
SET paystack_enabled = false
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
RESET ROLE;
DO $test$
BEGIN
  IF (
    SELECT count(*) FROM public.audit_events
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
      AND metadata ->> 'category' = 'merchant_feature_settings'
  ) IS DISTINCT FROM (
    SELECT event_count + 1 FROM audit_merchant_feature_settings_counts
    WHERE label = 'rollback-before'
  ) THEN
    RAISE EXCEPTION 'audited feature settings mutation did not emit before rollback';
  END IF;
END;
$test$;
ROLLBACK TO SAVEPOINT task5_rollback;
RESET ROLE;
DO $test$
BEGIN
  IF (
    SELECT count(*) FROM public.audit_events
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002'
      AND metadata ->> 'category' = 'merchant_feature_settings'
  ) IS DISTINCT FROM (
    SELECT event_count FROM audit_merchant_feature_settings_counts
    WHERE label = 'rollback-before'
  ) THEN
    RAISE EXCEPTION 'rolled-back feature settings mutation left an audit event';
  END IF;
END;
$test$;

-- Remove the automatic row then exercise an explicit insert/update/clear/delete
-- lifecycle with a full sentinel corpus. This models legacy clients that create
-- a missing settings row themselves.
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  '7e3f2e50-0000-4000-8000-000000000003',
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000003', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000003')::text,
  true
);
DELETE FROM public.merchant_feature_settings
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004';
INSERT INTO public.merchant_feature_settings (
  merchant_id, credit_direct_public_key, facebook_capi_token, ga4_api_secret,
  shipping_providers, repair_settings, custom_settings, pay_on_delivery_enabled
) VALUES (
  '7e3f2e50-0000-4000-8000-000000000004',
  'task5-credit-direct-public-key-sentinel-QWZX',
  'task5-facebook-capi-sentinel-RSTV',
  'task5-ga4-secret-sentinel-XQWZ',
  '["gigl", "task5-provider-secret-sentinel-ZTVW"]'::jsonb,
  pg_catalog.jsonb_build_object('contact_phone', 'task5-repair-contact-sentinel-WXQR'),
  pg_catalog.jsonb_build_object(
    'google_store_widget_enabled', true,
    'zohoCampaigns', pg_catalog.jsonb_build_object(
      'refreshToken', 'task5-custom-settings-secret-sentinel-QWZX',
      'nested', pg_catalog.jsonb_build_object('token', 'task5-nested-secret-fragment-RSTV')
    ),
    'task5-secret-key', 'task5-suffix-q7w9'
  ),
  false
);
RESET ROLE;

DO $test$
DECLARE v_event record; v_event_found boolean; v_audit_text text;
BEGIN
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004'
    AND metadata ->> 'category' = 'merchant_feature_settings'
    AND action = 'merchant.feature_settings.create'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  v_event_found := FOUND;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  IF NOT v_event_found
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e50-0000-4000-8000-000000000003'::uuid
     OR v_event.after_values -> 'credentials' -> 'ga4_api_secret'
        IS DISTINCT FROM '{"present":true,"state":"configured"}'::jsonb THEN
    RAISE EXCEPTION 'explicit feature settings insert did not retain safe lifecycle evidence';
  END IF;
  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle = 'create' ORDER BY value
    ),
    'explicit insert'
  );
END;
$test$;

-- A service mutation of two settings rows emits one event per row and shares
-- the writer-generated transaction identifier without trusting a caller value.
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT pg_catalog.set_config(
  'app.audit_database_transaction_id',
  'task5-hostile-transaction-identifier',
  true
);
UPDATE public.merchant_feature_settings
SET pay_on_delivery_enabled = false
WHERE merchant_id IN (
  '7e3f2e50-0000-4000-8000-000000000002',
  '7e3f2e50-0000-4000-8000-000000000004'
);
UPDATE public.merchant_feature_settings
SET pay_on_delivery_enabled = true
WHERE merchant_id IN (
  '7e3f2e50-0000-4000-8000-000000000002',
  '7e3f2e50-0000-4000-8000-000000000004'
);
RESET ROLE;
DO $test$
DECLARE
  v_current_transaction_id text := pg_catalog.pg_current_xact_id()::text;
  v_service_principal_count integer;
  v_writer_transaction_count integer;
BEGIN
  SELECT count(*) INTO v_writer_transaction_count
  FROM public.audit_events
  WHERE merchant_id IN (
    '7e3f2e50-0000-4000-8000-000000000002',
    '7e3f2e50-0000-4000-8000-000000000004'
  )
    AND metadata ->> 'category' = 'merchant_feature_settings'
    AND action = 'merchant.feature_settings.update'
    AND after_values ->> 'pay_on_delivery_enabled' = 'true'
    AND database_transaction_id = v_current_transaction_id;
  SELECT count(*) INTO v_service_principal_count
  FROM public.audit_events
  WHERE merchant_id IN (
    '7e3f2e50-0000-4000-8000-000000000002',
    '7e3f2e50-0000-4000-8000-000000000004'
  )
    AND metadata ->> 'category' = 'merchant_feature_settings'
    AND action = 'merchant.feature_settings.update'
    AND after_values ->> 'pay_on_delivery_enabled' = 'true'
    AND actor_user_id IS NULL
    AND actor_type = 'service'
    AND actor_label = 'service_role'
    AND source = 'api';
  IF (
    SELECT count(*) FROM public.audit_events
    WHERE merchant_id IN (
      '7e3f2e50-0000-4000-8000-000000000002',
      '7e3f2e50-0000-4000-8000-000000000004'
    )
      AND metadata ->> 'category' = 'merchant_feature_settings'
      AND action = 'merchant.feature_settings.update'
      AND after_values ->> 'pay_on_delivery_enabled' = 'true'
  ) IS DISTINCT FROM 2
     OR v_writer_transaction_count IS DISTINCT FROM 2
     OR v_service_principal_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'multi-row service mutation did not create grouped service-principal audit events';
  END IF;
END;
$test$;

-- ID and tenant reassignment must never repoint a settings event to a different
-- resource or merchant. Use service role to reach the trigger before RLS.
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
DELETE FROM public.merchant_feature_settings
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000006';
DO $test$
DECLARE v_id_reassignment_rejected boolean := false; v_merchant_reassignment_rejected boolean := false;
BEGIN
  BEGIN
    UPDATE public.merchant_feature_settings
    SET id = extensions.gen_random_uuid()
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM IS DISTINCT FROM 'audit_merchant_feature_settings_id_reassignment_forbidden' THEN
      RAISE;
    END IF;
    v_id_reassignment_rejected := true;
  END;
  BEGIN
    UPDATE public.merchant_feature_settings
    SET merchant_id = '7e3f2e50-0000-4000-8000-000000000006'
    WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000002';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM IS DISTINCT FROM 'audit_merchant_feature_settings_merchant_reassignment_forbidden' THEN
      RAISE;
    END IF;
    v_merchant_reassignment_rejected := true;
  END;
  IF NOT v_id_reassignment_rejected OR NOT v_merchant_reassignment_rejected THEN
    RAISE EXCEPTION 'feature settings row identity reassignment was not rejected';
  END IF;
END;
$test$;
RESET ROLE;

-- Deleting the explicit row captures its prior safe state and scans every
-- stored audit field for raw and derived credential leaks.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e50-0000-4000-8000-000000000003', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('role', 'authenticated', 'sub',
    '7e3f2e50-0000-4000-8000-000000000003')::text,
  true
);
UPDATE public.merchant_feature_settings
SET credit_direct_public_key = 'task5-credit-direct-public-key-delete-WXQR',
    facebook_capi_token = 'task5-facebook-capi-delete-ZTVW',
    ga4_api_secret = 'task5-ga4-secret-delete-QXWZ',
    custom_settings = pg_catalog.jsonb_build_object(
      'zohoCampaigns', pg_catalog.jsonb_build_object(
        'refreshToken', 'task5-custom-settings-secret-delete-RSTV',
        'nested', pg_catalog.jsonb_build_object('token', 'task5-nested-secret-delete-QWZX')
      )
    )
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004';
DELETE FROM public.merchant_feature_settings
WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004';
RESET ROLE;

DO $test$
DECLARE v_event record; v_event_found boolean; v_audit_text text;
BEGIN
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004'
    AND metadata ->> 'category' = 'merchant_feature_settings'
    AND action = 'merchant.feature_settings.delete'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  v_event_found := FOUND;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e50-0000-4000-8000-000000000004'
    AND metadata ->> 'category' = 'merchant_feature_settings';
  IF NOT v_event_found
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e50-0000-4000-8000-000000000003'::uuid
     OR v_event.before_values -> 'credentials' -> 'ga4_api_secret'
        IS DISTINCT FROM '{"present":true}'::jsonb THEN
    RAISE EXCEPTION 'feature settings deletion did not retain safe prior state';
  END IF;
  PERFORM pg_temp.assert_task5_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_merchant_feature_settings_sentinels
      WHERE lifecycle IN ('create', 'delete') ORDER BY value
    ),
    'explicit delete'
  );
END;
$test$;

ROLLBACK;
