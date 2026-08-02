DO $test$
DECLARE
  v_actor_id uuid := '7e3f2e10-0000-4000-8000-000000000101';
  v_target_id uuid := '7e3f2e10-0000-4000-8000-000000000102';
  v_merchant_id uuid := '7e3f2e10-0000-4000-8000-000000000103';
  v_staff_id uuid := '7e3f2e10-0000-4000-8000-000000000104';
  v_reassigned_staff_id uuid := '7e3f2e10-0000-4000-8000-000000000108';
  v_other_merchant_id uuid := '7e3f2e10-0000-4000-8000-000000000105';
  v_profile_staff_id uuid := '7e3f2e10-0000-4000-8000-000000000106';
  v_other_owner_id uuid := '7e3f2e10-0000-4000-8000-000000000107';
  v_event record;
  v_id_reassignment_rejected boolean := false;
  v_merchant_reassignment_rejected boolean := false;
  v_permissions_array_rejected boolean := false;
  v_permissions_json_null_rejected boolean := false;
  v_effective_permissions jsonb;
  v_event_count_before integer;
  v_event_count_after integer;
  v_orders_edit_granted boolean;
  v_orders_view_granted boolean;
  v_live_columns text[];
  v_classified_columns text[] := ARRAY[
    'accepted_at', 'created_at', 'email', 'id', 'invitation_expires_at',
    'invitation_token', 'invited_at', 'last_login_at', 'merchant_id', 'name',
    'permissions', 'phone', 'role', 'status', 'updated_at', 'user_id'
  ];
BEGIN
  SELECT pg_catalog.array_agg(column_name ORDER BY column_name)
    INTO v_live_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'staff_members';

  IF v_live_columns IS DISTINCT FROM (
    SELECT pg_catalog.array_agg(column_name ORDER BY column_name)
    FROM pg_catalog.unnest(v_classified_columns) AS classified(column_name)
  ) THEN
    RAISE EXCEPTION 'audit_staff_access_unclassified_probe: live=%, classified=%',
      v_live_columns, v_classified_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'private'
      AND procedure.oid = 'private.audit_staff_access_change_v1()'::regprocedure
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger
    WHERE trigger.tgrelid = 'public.staff_members'::regclass
      AND trigger.tgname = 'audit_staff_access_change_v1'
      AND trigger.tgfoid = 'private.audit_staff_access_change_v1()'::regprocedure
      AND NOT trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION 'staff access audit trigger is not installed';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES
    (
      v_actor_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'staff-audit-owner@example.com', 'test',
      now(), now(), now(), '{}'::jsonb, '{}'::jsonb
    ),
    (
      v_target_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'staff-audit-target@example.com', 'test',
      now(), now(), now(), '{}'::jsonb, '{}'::jsonb
    ),
    (
      v_other_owner_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'staff-audit-other-owner@example.com', 'test',
      now(), now(), now(), '{}'::jsonb, '{}'::jsonb
    );

  -- Merchant creation is governed by Task 2. Use the bounded database actor
  -- only for setup, then clear it before the direct authenticated lifecycle.
  PERFORM pg_catalog.set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_merchant_id, v_actor_id, 'staff-audit-merchant@example.com',
    'Staff Audit Merchant', 'staff-audit-merchant'
  );
  PERFORM pg_catalog.set_config('app.audit_actor_user_id', v_other_owner_id::text, true);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_other_merchant_id, v_other_owner_id, 'staff-audit-other-merchant@example.com',
    'Staff Audit Other Merchant', 'staff-audit-other-merchant'
  );
  PERFORM pg_catalog.set_config('app.audit_actor_user_id', '', true);

  -- Control the role defaults so the expected effective permission identifiers
  -- are hand-derived rather than copied from the implementation.
  UPDATE public.role_permissions
  SET permissions = '{"orders":{"view":true,"refund":false},"staff":{"view":false}}'::jsonb
  WHERE role = 'sales_rep';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff audit fixture requires the sales_rep role default';
  END IF;
  UPDATE public.role_permissions
  SET permissions = '{"catalog":{"view":true},"orders":{"view":true}}'::jsonb
  WHERE role = 'manager';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff audit fixture requires the manager role default';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  INSERT INTO public.staff_members (
    id, merchant_id, user_id, email, name, role, status
  ) VALUES (
    v_profile_staff_id, v_merchant_id, v_actor_id,
    'staff-audit-owner@example.com', 'Staff Audit Owner', 'admin', 'active'
  );
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_profile_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.access_created'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.after_values -> 'invitation' ->> 'token_present' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'active staff profile creation was mislabeled as an invitation';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  INSERT INTO public.staff_members (
    id, merchant_id, email, name, phone, role, permissions, status,
    invitation_token, invitation_expires_at, invited_at
  ) VALUES (
    v_staff_id, v_merchant_id, 'staff-audit-target@example.com', 'Staff Audit Target',
    '+2348012345678', 'sales_rep',
    '{"orders":{"view":false,"edit":true,"opaque":"never-copy"},"reports":{"view":true},"staff":{"view":true}}'::jsonb,
    'pending', 'staff-audit-token-first', now() + interval '7 days', now()
  );
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.invited'
     OR v_event.actor_user_id IS DISTINCT FROM v_actor_id
     OR v_event.actor_type IS DISTINCT FROM 'user'
     OR v_event.source IS DISTINCT FROM 'api'
     OR v_event.after_values ->> 'role' IS DISTINCT FROM 'sales_rep'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'pending'
     OR v_event.after_values -> 'permissions'
        IS DISTINCT FROM '["orders.edit", "reports.view", "staff.view"]'::jsonb
     OR v_event.after_values -> 'email' IS DISTINCT FROM '{"present":true}'::jsonb
     OR v_event.after_values -> 'phone' IS DISTINCT FROM '{"present":true}'::jsonb
     OR v_event.after_values ? 'target_user_id' THEN
    RAISE EXCEPTION 'invitation event did not derive the initiating actor, row merchant, or safe access snapshot';
  END IF;
END;
$test$;
