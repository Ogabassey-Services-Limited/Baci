-- Regression contract for 20260730000100_audit_merchant_identity_changes.sql.
-- This fixture runs after every pending migration and rolls back all rows.

BEGIN;

CREATE TEMP TABLE audit_identity_event_counts (
  label text PRIMARY KEY,
  event_count integer NOT NULL
);

DO $test$
DECLARE
  v_actor_id uuid := '7e3f2e10-0000-4000-8000-000000000001';
  v_merchant_id uuid := '7e3f2e10-0000-4000-8000-000000000002';
  v_event_count integer;
  v_event record;
  v_live_columns text[];
  v_exact_columns text[] := ARRAY[
    'business_name', 'country', 'email_logo_url', 'email_sender_name',
    'favicon_apple_touch_url', 'favicon_png_192_url', 'favicon_png_32_url',
    'favicon_svg_url', 'is_published', 'legal_entity_name', 'logo_url',
    'site_description', 'site_tagline', 'site_title', 'slug', 'social_media',
    'support_email', 'support_phone'
  ];
  v_presence_columns text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ];
  v_delegated_columns text[] := ARRAY[
    'bank_account_name', 'bank_code', 'bank_name', 'email_domain',
    'email_domain_verified', 'endpoint_scheme_id', 'facebook_pixel_id',
    'feature_settings', 'firs_business_id', 'firs_service_id',
    'gmc_variants_enabled', 'google_analytics_id', 'is_platform_admin',
    'kyc_status', 'multi_currency_enabled', 'offline_conversions_enabled',
    'paystack_subaccount_code', 'payout_currency', 'plan_tier',
    'premium_features', 'snapchat_pixel_id', 'stripe_customer_id',
    'stripe_subscription_id', 'tax_exempt', 'tiktok_pixel_id',
    'twitter_pixel_id', 'user_id', 'vat_rate', 'vat_registration_status'
  ];
  v_forbidden_columns text[] := ARRAY[
    'bank_account_number', 'bvn', 'cac_number', 'cac_rc_number', 'endpoint_id',
    'facebook_capi_access_token', 'facebook_capi_token', 'firs_certificate',
    'firs_email', 'firs_password_encrypted', 'firs_public_key',
    'ga4_api_secret', 'google_product_sheet_url', 'nin', 'rider_phone_number',
    'snapchat_capi_token', 'tax_identification_number', 'tiktok_access_token',
    'virtual_terminal_code'
  ];
  v_ignored_columns text[] := ARRAY[
    'about_page', 'brand_colors', 'business_type', 'created_at',
    'favicon_uploaded_at', 'faq_items', 'hero_image_ids',
    'hero_images_generated_at', 'hero_images_regeneration_count', 'hero_slides',
    'id', 'mobile_hero_slides', 'order_prefix', 'pages', 'plan_expires_at',
    'plan_started_at', 'published_at', 'published_config',
    'self_fulfillment_enabled', 'signup_source', 'template_id', 'trust_profile',
    'updated_at'
  ];
  v_classified_columns text[];
BEGIN
  v_classified_columns := v_exact_columns || v_presence_columns ||
    v_delegated_columns || v_forbidden_columns || v_ignored_columns;

  SELECT array_agg(column_name ORDER BY column_name)
  INTO v_live_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'merchants';

  IF (SELECT count(*) FROM unnest(v_classified_columns)) <>
       (SELECT count(DISTINCT column_name) FROM unnest(v_classified_columns) AS column_name)
     OR v_live_columns IS DISTINCT FROM (
       SELECT array_agg(column_name ORDER BY column_name)
       FROM unnest(v_classified_columns) AS column_name
     ) THEN
    RAISE EXCEPTION 'public.merchants audit classification is incomplete or overlapping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'private.audit_merchant_identity_change_v1()'::regprocedure
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'merchant identity trigger wrapper must be SECURITY DEFINER';
  END IF;
  IF EXISTS (
    SELECT 1
    -- PUBLIC is an ACL pseudo-role rather than a role accepted by
    -- has_function_privilege(); each application role below inherits it.
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(
      role_name,
      'private.audit_merchant_identity_change_v1()'::regprocedure,
      'EXECUTE'
    )
  ) THEN
    RAISE EXCEPTION 'merchant identity trigger wrapper is directly executable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_merchant_identity_schema_guard_v2'
      AND tgrelid = 'public.merchants'::regclass
      AND tgfoid = 'private.assert_merchant_identity_schema_classified_v2()'::regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'merchant identity schema guard trigger missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'private.assert_merchant_identity_schema_classified_v2()'::regprocedure
      AND prosecdef
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(
      role_name,
      'private.assert_merchant_identity_schema_classified_v2()'::regprocedure,
      'EXECUTE'
    )
  ) THEN
    RAISE EXCEPTION 'merchant identity schema guard is not owner-confined';
  END IF;
  IF (
    SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.merchants'::regclass
      AND tgname = ANY (ARRAY[
        'audit_merchant_identity_legacy_insert_v2',
        'audit_merchant_identity_legacy_delete_v2',
        'audit_merchant_identity_legacy_update_v2'
      ])
      AND NOT tgisinternal
  ) <> 3 THEN
    RAISE EXCEPTION 'merchant identity bounded legacy routes missing';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'merchant-identity-audit-owner@example.com', 'test', now(),
    now(), now(), '{}'::jsonb, '{}'::jsonb
  );

  -- No JWT exists during an owner-operated repair insert, so Task 1 must use
  -- the explicit transaction-local principal. The AFTER trigger must see the
  -- final, whitespace-normalized name rather than the submitted string.
  PERFORM set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (
    id, user_id, email, phone, business_name, slug, country, support_email,
    support_phone, registered_address, social_media
  ) VALUES (
    v_merchant_id, v_actor_id, 'merchant-private@example.com', '08001234567',
    '  Ogabassey   ', 'ogabassey-audit-fixture', 'Nigeria',
    'support@ogabassey.example', '+2348007654321',
    '{"street":"1 Audit Way","city":"Lagos","state":"Lagos","country":"Nigeria"}'::jsonb,
    '{"instagram":"@ogabassey"}'::jsonb
  );

  -- A merchant insert can legitimately produce a separate Task 4
  -- configuration event. This fixture proves only the identity domain.
  SELECT count(*) INTO v_event_count
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_event_count <> 1
     OR v_event.action <> 'merchant.identity.create'
     OR v_event.actor_user_id <> v_actor_id
     OR v_event.actor_type <> 'user'
     OR v_event.actor_label <> 'database_principal'
     OR v_event.after_values ->> 'business_name' <> 'Ogabassey' THEN
    RAISE EXCEPTION 'merchant insert must emit one normalized identity event';
  END IF;
  INSERT INTO audit_identity_event_counts VALUES ('insert', v_event_count);
END;
$test$;

-- New merchants columns must fail closed until one of the five classifications
-- explicitly owns it. This ALTER rolls back with the fixture.
ALTER TABLE public.merchants
  ADD COLUMN audit_identity_unclassified_probe text;
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchants
    SET audit_identity_unclassified_probe = 'identity-probe-direct-write'
    WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'unclassified merchants column unexpectedly bypassed audit guard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'audit_merchant_identity_unclassified_column' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
ALTER TABLE public.merchants
  DROP COLUMN audit_identity_unclassified_probe;

-- Reproduce the incident exactly: an authenticated direct update from
-- Ogabassey to pqthhi must retain actor, merchant, field, and exact public values.
INSERT INTO audit_identity_event_counts
SELECT 'pqthhi-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET business_name = 'pqthhi'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'pqthhi-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action = 'merchant.identity.update'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;

  IF v_after_count <> v_before_count + 1
     OR v_event.actor_user_id <> '7e3f2e10-0000-4000-8000-000000000001'::uuid
     OR v_event.actor_type <> 'user'
     OR v_event.changed_fields <> ARRAY['business_name']::text[]
     OR v_event.before_values <> '{"business_name":"Ogabassey"}'::jsonb
     OR v_event.after_values <> '{"business_name":"pqthhi"}'::jsonb THEN
    RAISE EXCEPTION 'pqthhi identity incident was not recorded with exact public values';
  END IF;
END;
$test$;

-- Audit inserts participate in the same transaction and therefore disappear
-- with an application rollback.
SAVEPOINT audit_merchant_identity_rollback;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET business_name = 'rollback-only identity change'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;
ROLLBACK TO SAVEPOINT audit_merchant_identity_rollback;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE id = '7e3f2e10-0000-4000-8000-000000000002'
      AND business_name = 'rollback-only identity change'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
      AND action LIKE 'merchant.identity.%'
      AND after_values ->> 'business_name' = 'rollback-only identity change'
  ) THEN
    RAISE EXCEPTION 'rolled-back merchant identity mutation leaked state or audit evidence';
  END IF;
END;
$test$;
