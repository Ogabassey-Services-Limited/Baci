-- Mobile direct settings writes are normal authenticated table updates.
INSERT INTO audit_identity_event_counts
SELECT 'mobile-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.changed_fields @> ARRAY['social_media', 'legal_entity_name', 'registered_address', 'business_address']::text[])
     OR v_event.after_values -> 'social_media' <> '{"instagram":"@ogabassey_social","linkedin":"https://linkedin.com/in/ogabassey"}'::jsonb
     OR v_event.after_values ->> 'legal_entity_name' <> 'Ogabassey Trading Ltd'
     OR v_event.after_values -> 'registered_address' <> '{"present":true}'::jsonb
     OR v_event.after_values -> 'business_address' <> '{"present":true}'::jsonb THEN
    RAISE EXCEPTION
      'social/settings RPC did not emit one safe identity event: before=%, after=%, fields=%, values=%',
      v_before_count, v_after_count, v_event.changed_fields, v_event.after_values;
  END IF;
END;
$test$;

-- Private values change state but never become event payload values; delegated
-- and secret-bearing columns are excluded even when they share the UPDATE.
INSERT INTO audit_identity_event_counts
SELECT 'redaction-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
