-- A raw social_media mutation must be auditable even when its safe projection
-- is unchanged. The unrelated no-op and updated_at-only writes stay silent.
INSERT INTO audit_identity_event_counts
SELECT 'raw-social-equal-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
),
    site_title = 'Raw social combined title'
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
UPDATE public.merchants SET updated_at = pg_catalog.now()
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_event record;
  v_payload text;
  v_social_media jsonb;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'raw-social-equal-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT social_media INTO v_social_media FROM public.merchants
  WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
  v_payload := COALESCE(v_event.before_values::text, '') ||
    COALESCE(v_event.after_values::text, '');
  IF v_after_count <> v_before_count + 1
     OR pg_catalog.cardinality(v_event.changed_fields) <> 2
     OR NOT (v_event.changed_fields @> ARRAY['social_media', 'site_title']::text[])
     OR v_event.before_values -> 'social_media' <> '{"twitter":"@audit_safe"}'::jsonb
     OR v_event.after_values -> 'social_media' <> '{"twitter":"@audit_safe"}'::jsonb
     OR v_event.after_values ->> 'site_title' <> 'Raw social combined title'
     OR v_social_media ->> 'twitter' <> '  @audit_safe  '
     OR position('another-social-secret' in v_payload) > 0 THEN
    RAISE EXCEPTION 'combined equal-projection social mutation was not safely audited';
  END IF;
END;
$test$;

-- A recognized-to-unsupported change and a subsequent unsupported-to-
-- unsupported change must each be recorded without serializing either raw JSON.
INSERT INTO audit_identity_event_counts
SELECT 'non-object-social-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
DECLARE
  v_first_event record;
  v_latest_event record;
  v_before_count integer;
  v_after_count integer;
  v_payload text;
  v_social_media jsonb;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'non-object-social-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_latest_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT * INTO v_first_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC OFFSET 1 LIMIT 1;
  SELECT social_media INTO v_social_media FROM public.merchants
  WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_payload
  FROM (
    SELECT *
    FROM public.audit_events
    WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
      AND action LIKE 'merchant.identity.%'
    ORDER BY occurred_at DESC, id DESC
    LIMIT 2
  ) AS audit_event;
  IF v_after_count <> v_before_count + 2
     OR pg_catalog.jsonb_typeof(v_social_media) <> 'array'
     OR v_first_event.before_values -> 'social_media' <> '{"twitter":"@audit_safe"}'::jsonb
     OR v_first_event.after_values -> 'social_media' <> '{}'::jsonb
     OR v_latest_event.before_values -> 'social_media' <> '{}'::jsonb
     OR v_latest_event.after_values -> 'social_media' <> '{}'::jsonb
     OR position('untrusted-social-scalar' in v_payload) > 0
     OR position('untrusted-social-array' in v_payload) > 0 THEN
    RAISE EXCEPTION 'non-object social_media mutations leaked or were not safely audited';
  END IF;
END;
$test$;
