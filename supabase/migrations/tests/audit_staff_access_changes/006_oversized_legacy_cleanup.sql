-- A preexisting unconstrained permission document must not trap a membership.
-- The audit snapshot is deliberately redacted, never partially truncated.
DO $test$
DECLARE
  v_cleanup_id uuid := '7e3f2e10-0000-4000-8000-000000000109';
  v_delete_id uuid := '7e3f2e10-0000-4000-8000-000000000110';
  v_cascade_owner_id uuid := '7e3f2e10-0000-4000-8000-000000000111';
  v_cascade_merchant_id uuid := '7e3f2e10-0000-4000-8000-000000000112';
  v_cascade_staff_id uuid := '7e3f2e10-0000-4000-8000-000000000113';
  v_oversized_permissions jsonb;
  v_event record;
BEGIN
  SELECT pg_catalog.jsonb_object_agg(
    'resource' || series.value::text,
    pg_catalog.jsonb_build_object('view', true)
  ) INTO v_oversized_permissions
  FROM pg_catalog.generate_series(1, 400) AS series(value);

  IF pg_catalog.octet_length(v_oversized_permissions::text) <= 4096 THEN
    RAISE EXCEPTION 'oversized staff permission fixture is not oversized';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101', true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"authenticated","sub":"7e3f2e10-0000-4000-8000-000000000101"}',
    true
  );
  INSERT INTO public.staff_members (id, merchant_id, email, name, role, permissions, status)
  VALUES (
    v_cleanup_id, '7e3f2e10-0000-4000-8000-000000000103',
    'staff-audit-oversized-cleanup@example.com', 'Oversized Cleanup',
    'sales_rep', v_oversized_permissions, 'active'
  );
  UPDATE public.staff_members
  SET permissions = NULL, role = 'manager'
  WHERE id = v_cleanup_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE resource_type = 'staff_member' AND resource_id = v_cleanup_id::text
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF NOT FOUND
    OR v_event.action IS DISTINCT FROM 'staff.role_changed'
    OR v_event.before_values -> 'permissions'
       IS DISTINCT FROM '["__audit_projection_redacted__"]'::jsonb
    OR pg_catalog.octet_length(v_event.before_values::text) > 16384
    OR pg_catalog.octet_length(v_event.after_values::text) > 16384 THEN
    RAISE EXCEPTION 'oversized staff cleanup did not emit a bounded redacted role event';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101', true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"authenticated","sub":"7e3f2e10-0000-4000-8000-000000000101"}',
    true
  );
  INSERT INTO public.staff_members (id, merchant_id, email, name, role, permissions, status)
  VALUES (
    v_delete_id, '7e3f2e10-0000-4000-8000-000000000103',
    'staff-audit-oversized-delete@example.com', 'Oversized Delete',
    'sales_rep', v_oversized_permissions, 'active'
  );
  RESET ROLE;
  DELETE FROM public.staff_members WHERE id = v_delete_id;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE resource_type = 'staff_member' AND resource_id = v_delete_id::text
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF NOT FOUND
    OR v_event.action IS DISTINCT FROM 'staff.removed'
    OR v_event.before_values -> 'permissions'
       IS DISTINCT FROM '["__audit_projection_redacted__"]'::jsonb THEN
    RAISE EXCEPTION 'oversized staff physical delete did not emit a redacted removal event';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_cascade_owner_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'staff-audit-cascade-owner@example.com', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );
  PERFORM pg_catalog.set_config('request.jwt.claim.role', '', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
  PERFORM pg_catalog.set_config(
    'app.audit_actor_user_id', v_cascade_owner_id::text, true
  );
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_cascade_merchant_id, v_cascade_owner_id,
    'staff-audit-cascade@example.com', 'Staff Audit Cascade', 'staff-audit-cascade'
  );

  INSERT INTO public.staff_members (id, merchant_id, email, name, role, permissions, status)
  VALUES (
    v_cascade_staff_id, v_cascade_merchant_id,
    'staff-audit-oversized-cascade@example.com', 'Oversized Cascade',
    'sales_rep', v_oversized_permissions, 'active'
  );
  DELETE FROM public.merchants WHERE id = v_cascade_merchant_id;
  PERFORM pg_catalog.set_config('app.audit_actor_user_id', '', true);

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE resource_type = 'staff_member' AND resource_id = v_cascade_staff_id::text
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF NOT FOUND
    OR v_event.action IS DISTINCT FROM 'staff.removed'
    OR v_event.merchant_id IS DISTINCT FROM v_cascade_merchant_id
    OR v_event.merchant_label IS NOT NULL
    OR v_event.before_values -> 'permissions'
       IS DISTINCT FROM '["__audit_projection_redacted__"]'::jsonb THEN
    RAISE EXCEPTION 'oversized staff merchant cascade did not emit a redacted removal event';
  END IF;
END;
$test$;
