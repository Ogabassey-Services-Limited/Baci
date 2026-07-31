-- Asset URL projections retain only a useful public origin/path. Credentials,
-- queries, and fragments must never become immutable audit payload values.
INSERT INTO audit_identity_event_counts
SELECT 'asset-url-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET logo_url = 'https://asset-user:asset-password@cdn.example/logo-public.svg?asset-query-secret=1#asset-fragment-secret',
    email_logo_url = 'https://token:secret',
    favicon_svg_url = 'https://favicon-user@cdn.example/favicon.svg#favicon-fragment-secret',
    favicon_png_32_url = 'https://cdn.example/favicon-32.png?favicon-32-secret=1',
    favicon_png_192_url = E'https://cdn.example/\nprivate-path-token',
    favicon_apple_touch_url = 'https://example.com:private-token',
    social_media = '{"twitter":"@audit_safe"}'::jsonb
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_event record;
  v_payload text;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'asset-url-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  v_payload := COALESCE(v_event.before_values::text, '') ||
    COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR v_event.after_values ->> 'logo_url' <> 'https://cdn.example/logo-public.svg'
     OR v_event.after_values ->> 'email_logo_url' <> '[redacted_url]'
     OR v_event.after_values ->> 'favicon_svg_url' <> 'https://cdn.example/favicon.svg'
     OR v_event.after_values ->> 'favicon_png_32_url' <> 'https://cdn.example/favicon-32.png'
     OR v_event.after_values ->> 'favicon_png_192_url' <> '[redacted_url]'
     OR v_event.after_values ->> 'favicon_apple_touch_url' <> '[redacted_url]'
     OR position('asset-user' in v_payload) > 0
     OR position('asset-password' in v_payload) > 0
     OR position('query-secret' in v_payload) > 0
     OR position('fragment-secret' in v_payload) > 0
     OR position('private-path-token' in v_payload) > 0 THEN
    RAISE EXCEPTION 'merchant identity asset URL projection leaked private URL components';
  END IF;
END;
$test$;

-- Large private URL components must be measured after projection so a safe,
-- useful asset change does not fall into the generic oversized cleanup path.
INSERT INTO audit_identity_event_counts
SELECT 'large-asset-query-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET logo_url = 'https://cdn.example/large-logo.svg?private=' || repeat('x', 20000)
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_event record;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'large-asset-query-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.after_values ->> 'logo_url' <> 'https://cdn.example/large-logo.svg' THEN
    RAISE EXCEPTION 'large private asset query used the oversized cleanup writer';
  END IF;
END;
$test$;

-- The raw-social writer owns equal-projection social updates. It must apply
-- the same asset projection when the statement also changes a public URL.
INSERT INTO audit_identity_event_counts
SELECT 'raw-social-asset-url-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants
SET social_media = pg_catalog.jsonb_build_object('twitter', ' @audit_safe '),
    logo_url = 'https://raw-user:raw-password@cdn.example/raw-logo.svg?raw-query-secret=1#raw-fragment-secret'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_event record;
  v_payload text;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'raw-social-asset-url-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  v_payload := COALESCE(v_event.before_values::text, '') ||
    COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR NOT (v_event.changed_fields @> ARRAY['social_media', 'logo_url']::text[])
     OR v_event.after_values ->> 'logo_url' <> 'https://cdn.example/raw-logo.svg'
     OR position('raw-user' in v_payload) > 0
     OR position('raw-password' in v_payload) > 0
     OR position('raw-query-secret' in v_payload) > 0
     OR position('raw-fragment-secret' in v_payload) > 0 THEN
    RAISE EXCEPTION 'raw-social writer leaked private asset URL components';
  END IF;
END;
$test$;

-- Merchant identifiers anchor every prior audit event. Reassignment must fail
-- before it can strand existing history under an obsolete UUID.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchants
    SET id = '7e3f2e10-0000-4000-8000-000000000003'
    WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'merchant primary-key reassignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023'
       OR SQLERRM <> 'audit_merchant_identity_primary_key_reassignment_forbidden' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
RESET ROLE;
