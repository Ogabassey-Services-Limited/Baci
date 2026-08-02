SAVEPOINT audit_staff_access_rollback;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'role', 'authenticated',
    'sub', '7e3f2e10-0000-4000-8000-000000000101'
  )::text,
  true
);
UPDATE public.staff_members
SET role = 'admin'
WHERE id = '7e3f2e10-0000-4000-8000-000000000104';
ROLLBACK TO SAVEPOINT audit_staff_access_rollback;
RESET ROLE;

DO $test$
DECLARE
  v_event_count integer;
  v_remove_before_count integer;
BEGIN
  SELECT count(*) INTO v_event_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104';
  SELECT event_count INTO v_remove_before_count
  FROM audit_staff_access_event_counts
  WHERE label = 'remove-before';
  IF v_event_count IS DISTINCT FROM v_remove_before_count THEN
    RAISE EXCEPTION 'rolled-back staff mutation left an audit event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
      AND event.resource_type = 'staff_member'
      AND (
        event.changed_fields @> ARRAY['invitation_token']::text[]
        OR COALESCE(event.before_values::text, '') LIKE '%staff-audit-token-first%'
        OR COALESCE(event.before_values::text, '') LIKE '%staff-audit-token-rotated%'
        OR COALESCE(event.after_values::text, '') LIKE '%staff-audit-token-first%'
        OR COALESCE(event.after_values::text, '') LIKE '%staff-audit-token-rotated%'
        OR COALESCE(event.before_values::text, '') LIKE '%staff-audit-token-reinvited%'
        OR COALESCE(event.after_values::text, '') LIKE '%staff-audit-token-reinvited%'
        OR COALESCE(event.before_values::text, '') LIKE '%staff-audit-target@example.com%'
        OR COALESCE(event.after_values::text, '') LIKE '%staff-audit-target@example.com%'
        OR COALESCE(event.before_values::text, '') LIKE '%+2348012345678%'
        OR COALESCE(event.after_values::text, '') LIKE '%+2348012345678%'
        OR COALESCE(event.before_values::text, '') LIKE '%never-copy%'
        OR COALESCE(event.after_values::text, '') LIKE '%never-copy%'
      )
  ) THEN
    RAISE EXCEPTION 'staff audit payload retained a forbidden token, contact value, or raw permission value';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_each(
      COALESCE(event.before_values, '{}'::jsonb)
    ) AS before_value(field_name, value)
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
      AND event.resource_type = 'staff_member'
      AND before_value.field_name IN ('email', 'name', 'phone')
      AND (
        pg_catalog.jsonb_typeof(before_value.value) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(before_value.value -> 'present') IS DISTINCT FROM 'boolean'
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_object_keys(before_value.value) AS key(name)
          WHERE key.name IS DISTINCT FROM 'present'
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_each(
      COALESCE(event.after_values, '{}'::jsonb)
    ) AS after_value(field_name, value)
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
      AND event.resource_type = 'staff_member'
      AND after_value.field_name IN ('email', 'name', 'phone')
      AND (
        pg_catalog.jsonb_typeof(after_value.value) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(after_value.value -> 'present') IS DISTINCT FROM 'boolean'
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_object_keys(after_value.value) AS key(name)
          WHERE key.name IS DISTINCT FROM 'present'
        )
      )
  ) THEN
    RAISE EXCEPTION 'staff target contact fields must be presence-only';
  END IF;

  -- The top-level payload shape is intentionally closed. This rejects future
  -- contact hash/mask fragments (for example, email_hash or phone_mask) even
  -- when their value does not contain one of this fixture's literal contacts.
  IF EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(
      COALESCE(event.before_values, '{}'::jsonb)
    ) AS before_key(name)
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
      AND event.resource_type = 'staff_member'
      AND before_key.name NOT IN (
        'acceptance', 'email', 'invitation', 'name', 'permissions', 'phone',
        'role', 'status', 'target_user_id'
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(
      COALESCE(event.after_values, '{}'::jsonb)
    ) AS after_key(name)
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'
      AND event.resource_type = 'staff_member'
      AND after_key.name NOT IN (
        'acceptance', 'email', 'invitation', 'name', 'permissions', 'phone',
        'role', 'status', 'target_user_id'
      )
  ) THEN
    RAISE EXCEPTION 'staff audit payload contained an unapproved field';
  END IF;
END;
$test$;
