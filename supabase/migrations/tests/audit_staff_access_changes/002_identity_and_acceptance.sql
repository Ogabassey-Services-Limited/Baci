DO $test$
DECLARE
  v_event record;
  v_id_reassignment_rejected boolean := false;
  v_merchant_reassignment_rejected boolean := false;
BEGIN
  -- A membership cannot silently move between merchant tenants, including
  -- privileged/internal writes that bypass normal owner RLS checks.
  BEGIN
    UPDATE public.staff_members
    SET merchant_id = '7e3f2e10-0000-4000-8000-000000000105'::uuid
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_merchant_reassignment_forbidden' THEN
        RAISE EXCEPTION 'staff merchant reassignment raised unexpected error: %', SQLERRM;
      END IF;
      v_merchant_reassignment_rejected := true;
  END;
  IF NOT v_merchant_reassignment_rejected THEN
    RAISE EXCEPTION 'staff merchant reassignment was not rejected';
  END IF;

  -- Owners can otherwise update this row through authenticated RLS. The stable
  -- row identity must still remain immutable so later events cannot fork onto
  -- a different resource id without an audit record.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  BEGIN
    UPDATE public.staff_members
    SET id = '7e3f2e10-0000-4000-8000-000000000108'::uuid
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_id_reassignment_forbidden' THEN
        RAISE EXCEPTION 'staff id reassignment raised unexpected error: %', SQLERRM;
      END IF;
      v_id_reassignment_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_id_reassignment_rejected THEN
    RAISE EXCEPTION 'staff id reassignment was not rejected';
  END IF;

  -- The PATCH contract permits a status-only activation. It must not be
  -- mislabeled as an invitation acceptance without target and acceptance state.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'active' WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.status_changed'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.after_values ? 'acceptance'
     OR v_event.after_values ? 'target_user_id' THEN
    RAISE EXCEPTION 'status-only activation was mislabeled as staff acceptance';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'pending' WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET accepted_at = now() WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.access_changed'
     OR v_event.after_values -> 'acceptance' IS DISTINCT FROM '{"accepted":true}'::jsonb THEN
    RAISE EXCEPTION 'partial acceptance state was mislabeled as staff acceptance';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET accepted_at = NULL WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  INSERT INTO audit_staff_access_event_counts
  SELECT 'invited-before-resend', count(*)
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET invitation_token = 'staff-audit-token-rotated',
      invitation_expires_at = now() + interval '7 days',
      invited_at = now()
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  IF (
    SELECT count(*)
    FROM public.audit_events
    WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
      AND resource_type = 'staff_member'
      AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ) IS DISTINCT FROM (
    SELECT event_count + 1
    FROM audit_staff_access_event_counts
    WHERE label = 'invited-before-resend'
  ) THEN
    RAISE EXCEPTION 'invitation rotation did not emit exactly one audit event';
  END IF;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.invited'
     OR v_event.changed_fields IS DISTINCT FROM ARRAY['invitation']::text[]
     OR (v_event.before_values ? 'invitation') IS DISTINCT FROM true
     OR (v_event.after_values ? 'invitation') IS DISTINCT FROM true
     OR v_event.before_values -> 'invitation'
        IS DISTINCT FROM v_event.after_values -> 'invitation' THEN
    RAISE EXCEPTION 'invitation rotation did not produce a safe, standalone staff invitation event';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000102'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.email',
    'staff-audit-target@example.com',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'email', 'staff-audit-target@example.com',
      'role', 'authenticated',
      'sub', '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
    )::text,
    true
  );
  PERFORM 1
  FROM public.accept_staff_invite(
    'staff-audit-token-rotated',
    'staff-audit-target@example.com'
  );
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.accepted'
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid
     OR v_event.actor_type IS DISTINCT FROM 'user'
     OR v_event.source IS DISTINCT FROM 'api'
     OR v_event.merchant_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000103'::uuid
     OR v_event.resource_type IS DISTINCT FROM 'staff_member'
     OR v_event.resource_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values -> 'acceptance' IS DISTINCT FROM '{"accepted":true}'::jsonb THEN
    RAISE EXCEPTION 'accepted invitation did not derive the invitee actor, row merchant, resource, or safe target state';
  END IF;
END;
$test$;
