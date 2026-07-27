-- Regression contract for 20260726160100_audit_merchant_identity_changes.sql.
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
    WHERE tgname = 'audit_merchant_identity_change_v1'
      AND tgrelid = 'public.merchants'::regclass
      AND tgfoid = 'private.audit_merchant_identity_change_v1()'::regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'merchant identity audit trigger missing';
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

  SELECT count(*) INTO v_event_count
  FROM public.audit_events WHERE merchant_id = v_merchant_id;
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
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
    SET support_phone = support_phone
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
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
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
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
      AND after_values ->> 'business_name' = 'rollback-only identity change'
  ) THEN
    RAISE EXCEPTION 'rolled-back merchant identity mutation leaked state or audit evidence';
  END IF;
END;
$test$;

-- Mobile direct settings writes are normal authenticated table updates.
INSERT INTO audit_identity_event_counts
SELECT 'mobile-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET support_email = 'mobile-settings@ogabassey.example',
    support_phone = '+2348001111111',
    state_code = 'LA',
    lga_code = 'IKEJA'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'mobile-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.changed_fields @> ARRAY['support_email', 'support_phone', 'state_code', 'lga_code']::text[])
     OR v_event.after_values ->> 'support_email' <> 'mobile-settings@ogabassey.example'
     OR v_event.after_values ->> 'support_phone' <> '+2348001111111'
     OR v_event.after_values -> 'state_code' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'lga_code' <> '{"present":true}'::jsonb THEN
    RAISE EXCEPTION 'mobile direct settings update did not emit one safe identity event';
  END IF;
END;
$test$;

-- Generic web writes cover public storefront/SEO identity fields exactly.
INSERT INTO audit_identity_event_counts
SELECT 'web-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET logo_url = 'https://cdn.example/logo.svg',
    email_logo_url = 'https://cdn.example/email-logo.svg',
    favicon_svg_url = 'https://cdn.example/favicon.svg',
    favicon_png_32_url = 'https://cdn.example/favicon-32.png',
    favicon_png_192_url = 'https://cdn.example/favicon-192.png',
    favicon_apple_touch_url = 'https://cdn.example/apple-touch.png',
    site_title = 'Ogabassey Store',
    site_tagline = 'Trusted goods',
    site_description = 'Public storefront description'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'web-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.after_values @> '{"logo_url":"https://cdn.example/logo.svg","email_logo_url":"https://cdn.example/email-logo.svg","site_title":"Ogabassey Store","site_tagline":"Trusted goods","site_description":"Public storefront description"}'::jsonb)
     OR NOT (v_event.changed_fields @> ARRAY['favicon_apple_touch_url', 'favicon_png_192_url', 'favicon_png_32_url', 'favicon_svg_url']::text[]) THEN
    RAISE EXCEPTION 'generic web identity update did not retain the expected public projection';
  END IF;
END;
$test$;

-- The existing atomic social/settings RPC must create one row-level event,
-- including only allowlisted social handles and safe settings projections.
INSERT INTO audit_identity_event_counts
SELECT 'social-rpc-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
SELECT public.update_merchant_social_media(
  '7e3f2e10-0000-4000-8000-000000000002',
  '{"instagram":" @ogabassey_social ","linkedin":"https://linkedin.com/in/ogabassey"}'::jsonb,
  false,
  '{"legal_entity_name":"Ogabassey Trading Ltd","state_code":"LA","registered_address":{"street":"2 Audit Avenue","city":"Ikeja","state":"Lagos","postal_code":"100001","country":"Nigeria"}}'::jsonb
);
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'social-rpc-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.changed_fields @> ARRAY['social_media', 'legal_entity_name', 'registered_address', 'business_address']::text[])
     OR v_event.after_values -> 'social_media' <> '{"instagram":"@ogabassey_social","linkedin":"https://linkedin.com/in/ogabassey"}'::jsonb
     OR v_event.after_values ->> 'legal_entity_name' <> 'Ogabassey Trading Ltd'
     OR v_event.after_values -> 'registered_address' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'business_address' <> '{"present":true}'::jsonb THEN
    RAISE EXCEPTION 'social/settings RPC did not emit one safe identity event';
  END IF;
END;
$test$;

-- Private values change state but never become event payload values; delegated
-- and secret-bearing columns are excluded even when they share the UPDATE.
INSERT INTO audit_identity_event_counts
SELECT 'redaction-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET email = 'new-private-email@example.com',
    phone = '08009998888',
    registered_address = '{"street":"3 Private Road","city":"Abuja","state":"FCT","postal_code":"900001","country":"Nigeria"}'::jsonb,
    country = 'Nigeria',
    social_media = '{"instagram":"@redacted","internal_token":"social-secret-value"}'::jsonb,
    bank_account_number = '0123456789',
    nin = '12345678901',
    facebook_capi_token = 'facebook-capi-secret'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer; v_payload text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'redaction-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  v_payload := COALESCE(v_event.before_values::text, '') || COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.changed_fields @> ARRAY['email', 'phone', 'registered_address', 'business_address', 'social_media']::text[])
     OR v_event.after_values -> 'email' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'phone' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'registered_address' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'business_address' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'social_media' <> '{"instagram":"@redacted"}'::jsonb
     OR v_event.after_values ?| ARRAY['bank_account_number', 'nin', 'facebook_capi_token']
     OR position('new-private-email@example.com' in v_payload) > 0
     OR position('08009998888' in v_payload) > 0
     OR position('3 Private Road' in v_payload) > 0
     OR position('0123456789' in v_payload) > 0
     OR position('12345678901' in v_payload) > 0
     OR position('facebook-capi-secret' in v_payload) > 0
     OR position('social-secret-value' in v_payload) > 0 THEN
    RAISE EXCEPTION 'identity audit payload leaked private, delegated, or secret values';
  END IF;
END;
$test$;

-- Direct table writes may retain legacy arbitrary values, but the immutable
-- audit payload must admit only bounded public handle/official-URL projections.
-- This protects the ledger even when an allowed key carries a token, a
-- lookalike domain, URL credentials, a query, a fragment, or a port.
INSERT INTO audit_identity_event_counts
SELECT 'unsafe-social-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET social_media = pg_catalog.jsonb_build_object(
  'instagram', '@' || pg_catalog.repeat('p', 256),
  'linkedin', 'https://linkedin.evil.example/ogabassey',
  'facebook', 'https://audit-user@facebook.com/audit_safe_handle',
  'tiktok', 'https://www.tiktok.com/@audit_safe_handle?token=tiktok-secret',
  'youtube', 'https://www.youtube.com/@audit_safe_handle#youtube-secret',
  'snapchat', 'https://www.snapchat.com:443/add/audit_safe_handle',
  'pinterest', 'facebook-capi-secret',
  'twitter', '@audit_safe'
)
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
  v_payload text; v_social_media jsonb;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'unsafe-social-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT social_media INTO v_social_media FROM public.merchants
  WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
  v_payload := COALESCE(v_event.before_values::text, '') || COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR pg_catalog.octet_length(v_social_media ->> 'instagram') <> 257
     OR v_social_media ->> 'linkedin' <> 'https://linkedin.evil.example/ogabassey'
     OR v_social_media ->> 'facebook' <> 'https://audit-user@facebook.com/audit_safe_handle'
     OR v_social_media ->> 'tiktok' <> 'https://www.tiktok.com/@audit_safe_handle?token=tiktok-secret'
     OR v_social_media ->> 'youtube' <> 'https://www.youtube.com/@audit_safe_handle#youtube-secret'
     OR v_social_media ->> 'snapchat' <> 'https://www.snapchat.com:443/add/audit_safe_handle'
     OR v_social_media ->> 'pinterest' <> 'facebook-capi-secret'
     OR v_event.before_values -> 'social_media' <> '{"instagram":"@redacted"}'::jsonb
     OR v_event.after_values -> 'social_media' <> '{"twitter":"@audit_safe"}'::jsonb
     OR position('facebook-capi-secret' in v_payload) > 0
     OR position('https://linkedin.evil.example/ogabassey' in v_payload) > 0
     OR position('https://audit-user@facebook.com/audit_safe_handle' in v_payload) > 0
     OR position('https://www.tiktok.com/@audit_safe_handle?token=tiktok-secret' in v_payload) > 0
     OR position('https://www.youtube.com/@audit_safe_handle#youtube-secret' in v_payload) > 0
     OR position('https://www.snapchat.com:443/add/audit_safe_handle' in v_payload) > 0
     OR position(pg_catalog.repeat('p', 128) in v_payload) > 0 THEN
    RAISE EXCEPTION 'identity audit payload admitted an unsafe allowed-key social value';
  END IF;
END;
$test$;

-- No-op governed updates, a whitespace-only social-handle representation, and
-- updated_at-only writes must be silent. The raw social_media JSON does change
-- here, but its allowlisted public projection remains the same normalized
-- handle, so this is intentionally not an identity-domain event.
INSERT INTO audit_identity_event_counts
SELECT 'silent-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants SET business_name = business_name
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
UPDATE public.merchants
SET social_media = pg_catalog.jsonb_build_object(
  'instagram', '@' || pg_catalog.repeat('p', 256),
  'linkedin', 'https://linkedin.evil.example/ogabassey',
  'facebook', 'https://audit-user@facebook.com/audit_safe_handle',
  'tiktok', 'https://www.tiktok.com/@audit_safe_handle?token=tiktok-secret',
  'youtube', 'https://www.youtube.com/@audit_safe_handle#youtube-secret',
  'snapchat', 'https://www.snapchat.com:443/add/audit_safe_handle',
  'pinterest', 'another-social-secret',
  'twitter', '  @audit_safe  '
)
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
UPDATE public.merchants SET updated_at = pg_catalog.now()
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_before_count integer; v_after_count integer; v_social_media jsonb;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'silent-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT social_media INTO v_social_media FROM public.merchants
  WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
  IF v_after_count <> v_before_count
     OR v_social_media ->> 'twitter' <> '  @audit_safe  ' THEN
    RAISE EXCEPTION 'no-op, normalized social handle, or updated_at-only merchant update emitted an identity event';
  END IF;
END;
$test$;

-- Non-object legacy JSON must neither crash the trigger nor appear verbatim in
-- the ledger. The scalar removes the previous safe projection once; the
-- following array has the same empty projection and is silent.
INSERT INTO audit_identity_event_counts
SELECT 'non-object-social-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET social_media = '"untrusted-social-scalar"'::jsonb
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
UPDATE public.merchants
SET social_media = '["untrusted-social-array"]'::jsonb
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
  v_payload text; v_social_media jsonb;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'non-object-social-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT social_media INTO v_social_media FROM public.merchants
  WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
  v_payload := COALESCE(v_event.before_values::text, '') || COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR pg_catalog.jsonb_typeof(v_social_media) <> 'array'
     OR v_event.before_values -> 'social_media' <> '{"twitter":"@audit_safe"}'::jsonb
     OR v_event.after_values -> 'social_media' <> '{}'::jsonb
     OR position('untrusted-social-scalar' in v_payload) > 0
     OR position('untrusted-social-array' in v_payload) > 0 THEN
    RAISE EXCEPTION 'non-object social_media leaked or did not retain a safe projection';
  END IF;
END;
$test$;

-- Service-role onboarding/repair writes receive the generic service principal.
INSERT INTO audit_identity_event_counts
SELECT 'service-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET email_sender_name = 'Ogabassey Service Repair'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'service-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.actor_user_id IS NOT NULL
     OR v_event.actor_type <> 'service'
     OR v_event.actor_label <> 'service_role'
     OR v_event.source <> 'api'
     OR v_event.after_values ->> 'email_sender_name' <> 'Ogabassey Service Repair' THEN
    RAISE EXCEPTION 'service-role repair did not retain generic service attribution';
  END IF;
END;
$test$;

-- Publication and the sanctioned slug-rename RPC each make one merchant-row
-- change; page-config propagation must not duplicate identity events.
INSERT INTO audit_identity_event_counts
SELECT 'publish-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants SET is_published = true
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'publish-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.changed_fields <> ARRAY['is_published']::text[]
     OR v_event.after_values <> '{"is_published":true}'::jsonb THEN
    RAISE EXCEPTION 'publish toggle did not emit exactly one public identity event';
  END IF;
END;
$test$;

INSERT INTO audit_identity_event_counts
SELECT 'rename-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
SELECT public.rename_merchant_slug(
  '7e3f2e10-0000-4000-8000-000000000002',
  'ogabassey-renamed-audit-fixture'
);
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'rename-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.changed_fields <> ARRAY['slug']::text[]
     OR v_event.after_values <> '{"slug":"ogabassey-renamed-audit-fixture"}'::jsonb THEN
    RAISE EXCEPTION 'sanctioned slug rename did not emit one identity event';
  END IF;
END;
$test$;

INSERT INTO audit_identity_event_counts
SELECT 'delete-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
DELETE FROM public.merchants
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE v_event record; v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_identity_event_counts WHERE label = 'delete-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.action <> 'merchant.identity.delete'
     OR v_event.resource_type <> 'merchant'
     OR v_event.resource_id <> '7e3f2e10-0000-4000-8000-000000000002'
     OR v_event.before_values ->> 'business_name' <> 'pqthhi'
     OR v_event.after_values IS NOT NULL THEN
    RAISE EXCEPTION 'merchant delete did not preserve the correct immutable identity snapshot';
  END IF;
END;
$test$;

ROLLBACK;
