DO $test$
DECLARE
  v_event record;
  v_event_count_before integer;
  v_event_count_after integer;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'suspended' WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.suspended'
     OR v_event.before_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'suspended'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'staff suspension did not retain the prior and new status';
  END IF;

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
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.reactivated'
     OR v_event.before_values ->> 'status' IS DISTINCT FROM 'suspended'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'staff reactivation did not retain the prior and new status';
  END IF;

  -- Mobile admin removes a staff member by status alone. Preserve the linked
  -- target user snapshot even when the row's user_id remains unchanged.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'removed' WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.removed'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'status-only removal did not preserve the linked target identity';
  END IF;

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

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET status = 'removed', user_id = NULL
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.removed'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ? 'target_user_id' THEN
    RAISE EXCEPTION 'staff removal did not retain the prior target identity without retaining a cleared one';
  END IF;

  -- This is the existing invite route's removed-to-pending re-invite shape:
  -- the prior acceptance and user link are cleared, and only safe invitation
  -- state is retained for the new pending membership.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET status = 'pending',
      invitation_token = 'staff-audit-token-reinvited',
      invitation_expires_at = now() + interval '7 days',
      invited_at = now(),
      accepted_at = NULL,
      user_id = NULL
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.reactivated'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'pending'
     OR v_event.after_values -> 'invitation' ->> 'token_present' IS DISTINCT FROM 'true'
     OR v_event.after_values -> 'acceptance' IS DISTINCT FROM '{"accepted":false}'::jsonb
     OR v_event.after_values ? 'target_user_id' THEN
    RAISE EXCEPTION 're-invite did not retain the safe pending membership state';
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
    'staff-audit-token-reinvited',
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
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 're-invited staff acceptance did not derive the invitee actor and target identity';
  END IF;

  SELECT count(*) INTO v_event_count_before
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
  SET status = status
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff no-op update did not target the fixture row';
  END IF;
  UPDATE public.staff_members
  SET updated_at = updated_at + interval '1 microsecond'
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff updated_at-only update did not target the fixture row';
  END IF;
  RESET ROLE;

  SELECT count(*) INTO v_event_count_after
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text;
  IF v_event_count_after IS DISTINCT FROM v_event_count_before THEN
    RAISE EXCEPTION 'staff no-op or updated_at-only update emitted an audit event';
  END IF;

  INSERT INTO audit_staff_access_event_counts
  SELECT 'remove-before', count(*)
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text;
END;
$test$;
