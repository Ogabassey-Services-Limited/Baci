-- Service-role onboarding/repair writes receive the generic service principal.
INSERT INTO audit_identity_event_counts
SELECT 'service-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
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
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
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
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  SELECT * INTO v_event FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 1
     OR v_event.changed_fields <> ARRAY['slug']::text[]
     OR v_event.after_values <> '{"slug":"ogabassey-renamed-audit-fixture"}'::jsonb THEN
    RAISE EXCEPTION 'sanctioned slug rename did not emit one identity event';
  END IF;
END;
$test$;

-- Newly oversized identity values remain blocked by the legacy payload guard.
INSERT INTO audit_identity_event_counts
SELECT 'oversized-new-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
DO $test$
BEGIN
  BEGIN
    UPDATE public.merchants
    SET site_description = pg_catalog.repeat('oversized-new-sentinel-', 800)
    WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'new oversized identity update unexpectedly bypassed payload guard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'audit_merchant_identity_payload_too_large' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'oversized-new-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
    AND action LIKE 'merchant.identity.%';
  IF v_after_count <> v_before_count THEN
    RAISE EXCEPTION 'new oversized identity update emitted or bypassed audit evidence';
  END IF;
END;
$test$;

-- Seed only pre-existing oversized state while its legacy writer is disabled.
-- The following authenticated clear must emit one bounded redaction event.
ALTER TABLE public.merchants
  DISABLE TRIGGER audit_merchant_identity_legacy_update_v2;
UPDATE public.merchants
SET site_description = pg_catalog.repeat('oversized-identity-sentinel-', 800)
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
ALTER TABLE public.merchants
  ENABLE TRIGGER audit_merchant_identity_legacy_update_v2;

INSERT INTO audit_identity_event_counts
SELECT 'oversized-clear-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
UPDATE public.merchants SET site_description = NULL
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_event record;
  v_payload text;
  v_marker jsonb := '{"state":"redacted","reason":"oversized_legacy_payload"}'::jsonb;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'oversized-clear-before';
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
     OR v_event.action <> 'merchant.identity.update'
     OR v_event.changed_fields <> ARRAY['site_description']::text[]
     OR v_event.before_values -> 'site_description' IS DISTINCT FROM v_marker
     OR v_event.after_values -> 'site_description' IS DISTINCT FROM v_marker
     OR position('oversized-identity-sentinel-' in v_payload) > 0 THEN
    RAISE EXCEPTION 'oversized identity cleanup was blocked or leaked raw content';
  END IF;
END;
$test$;

-- Seed a second pre-existing oversized row state and verify that deletion has
-- the same one-event, redacted path.
ALTER TABLE public.merchants
  DISABLE TRIGGER audit_merchant_identity_legacy_update_v2;
UPDATE public.merchants
SET site_description = pg_catalog.repeat('oversized-delete-sentinel-', 800)
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
ALTER TABLE public.merchants
  ENABLE TRIGGER audit_merchant_identity_legacy_update_v2;

INSERT INTO audit_identity_event_counts
SELECT 'oversized-delete-before', count(*) FROM public.audit_events
WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000002'
  AND action LIKE 'merchant.identity.%';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000001', true);
DELETE FROM public.merchants
WHERE id = '7e3f2e10-0000-4000-8000-000000000002';
RESET ROLE;

DO $test$
DECLARE
  v_event record;
  v_before_count integer;
  v_after_count integer;
  v_payload text;
  v_marker jsonb := '{"state":"redacted","reason":"oversized_legacy_payload"}'::jsonb;
BEGIN
  SELECT event_count INTO v_before_count
  FROM audit_identity_event_counts WHERE label = 'oversized-delete-before';
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
     OR v_event.action <> 'merchant.identity.delete'
     OR v_event.resource_type <> 'merchant'
     OR v_event.resource_id <> '7e3f2e10-0000-4000-8000-000000000002'
     OR v_event.before_values -> 'site_description' IS DISTINCT FROM v_marker
     OR v_event.after_values IS NOT NULL
     OR position('oversized-delete-sentinel-' in v_payload) > 0
     OR position('pqthhi' in v_payload) > 0 THEN
    RAISE EXCEPTION 'oversized identity deletion was blocked or leaked raw content';
  END IF;
END;
$test$;

ROLLBACK;
