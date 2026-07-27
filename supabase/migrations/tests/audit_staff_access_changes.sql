-- Regression contract for 20260726160200_audit_staff_access_changes.sql.
-- This fixture runs after the canonical ledger and merchant identity fixtures.

BEGIN;

CREATE TEMP TABLE audit_staff_access_event_counts (
  label text PRIMARY KEY,
  event_count integer NOT NULL
);

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

  -- A membership cannot silently move between merchant tenants, including
  -- privileged/internal writes that bypass normal owner RLS checks.
  BEGIN
    UPDATE public.staff_members
    SET merchant_id = v_other_merchant_id
    WHERE id = v_staff_id;
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  BEGIN
    UPDATE public.staff_members
    SET id = v_reassigned_staff_id
    WHERE id = v_staff_id;
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'active' WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'pending' WHERE id = v_staff_id;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET accepted_at = now() WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.access_changed'
     OR v_event.after_values -> 'acceptance' IS DISTINCT FROM '{"accepted":true}'::jsonb THEN
    RAISE EXCEPTION 'partial acceptance state was mislabeled as staff acceptance';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET accepted_at = NULL WHERE id = v_staff_id;
  RESET ROLE;

  INSERT INTO audit_staff_access_event_counts
  SELECT 'invited-before-resend', count(*)
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET invitation_token = 'staff-audit-token-rotated',
      invitation_expires_at = now() + interval '7 days',
      invited_at = now()
  WHERE id = v_staff_id;
  RESET ROLE;

  IF (
    SELECT count(*)
    FROM public.audit_events
    WHERE merchant_id = v_merchant_id
      AND resource_type = 'staff_member'
      AND resource_id = v_staff_id::text
  ) IS DISTINCT FROM (
    SELECT event_count + 1
    FROM audit_staff_access_event_counts
    WHERE label = 'invited-before-resend'
  ) THEN
    RAISE EXCEPTION 'invitation rotation did not emit exactly one audit event';
  END IF;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_target_id::text, true);
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
      'sub', v_target_id::text
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
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.accepted'
     OR v_event.actor_user_id IS DISTINCT FROM v_target_id
     OR v_event.actor_type IS DISTINCT FROM 'user'
     OR v_event.source IS DISTINCT FROM 'api'
     OR v_event.merchant_id IS DISTINCT FROM v_merchant_id
     OR v_event.resource_type IS DISTINCT FROM 'staff_member'
     OR v_event.resource_id IS DISTINCT FROM v_staff_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values -> 'acceptance' IS DISTINCT FROM '{"accepted":true}'::jsonb THEN
    RAISE EXCEPTION 'accepted invitation did not derive the invitee actor, row merchant, resource, or safe target state';
  END IF;

  -- Runtime permission resolution deep-merges only SQL NULL with role defaults;
  -- non-object JSON would instead make jsonb_each fail later. Reject malformed
  -- direct authenticated writes before they can leave a broken membership row.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  BEGIN
    UPDATE public.staff_members
    SET permissions = '[]'::jsonb
    WHERE id = v_staff_id;
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_permissions_shape_invalid' THEN
        RAISE EXCEPTION 'array permissions raised unexpected error: %', SQLERRM;
      END IF;
      v_permissions_array_rejected := true;
  END;
  BEGIN
    UPDATE public.staff_members
    SET permissions = 'null'::jsonb
    WHERE id = v_staff_id;
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_permissions_shape_invalid' THEN
        RAISE EXCEPTION 'JSON null permissions raised unexpected error: %', SQLERRM;
      END IF;
      v_permissions_json_null_rejected := true;
  END;
  RESET ROLE;
  IF NOT v_permissions_array_rejected OR NOT v_permissions_json_null_rejected THEN
    RAISE EXCEPTION 'non-object permissions were not rejected';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = NULL
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions'
        IS DISTINCT FROM '["orders.view"]'::jsonb THEN
    RAISE EXCEPTION 'SQL NULL permissions did not retain role-default audit semantics';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  SELECT public.get_staff_permissions(v_staff_id) INTO v_effective_permissions;
  RESET ROLE;
  IF v_effective_permissions IS DISTINCT FROM (
    SELECT permissions
    FROM public.role_permissions
    WHERE role = 'sales_rep'
  ) THEN
    RAISE EXCEPTION 'SQL NULL permissions did not preserve runtime role defaults';
  END IF;

  -- The runtime permission helpers accept PostgreSQL boolean spellings from
  -- direct table writes. Audit must retain their effective grant/revoke result
  -- without retaining the raw JSON representation.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = '{"orders":{"edit":"true","view":"false"}}'::jsonb
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions' IS DISTINCT FROM '["orders.edit"]'::jsonb
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'string boolean permission overrides did not retain their effective audit grant set';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_target_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_target_id::text)::text,
    true
  );
  SELECT public.check_staff_permission(
    v_target_id,
    v_merchant_id,
    'orders',
    'edit'
  ) INTO v_orders_edit_granted;
  SELECT public.check_staff_permission(
    v_target_id,
    v_merchant_id,
    'orders',
    'view'
  ) INTO v_orders_view_granted;
  RESET ROLE;
  IF v_orders_edit_granted IS DISTINCT FROM true
     OR v_orders_view_granted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'runtime permission helpers disagreed with the audited string boolean projection';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET role = 'manager'
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.role_changed'
     OR v_event.actor_user_id IS DISTINCT FROM v_actor_id
     OR v_event.actor_type IS DISTINCT FROM 'user'
     OR v_event.source IS DISTINCT FROM 'api'
     OR v_event.merchant_id IS DISTINCT FROM v_merchant_id
     OR v_event.resource_type IS DISTINCT FROM 'staff_member'
     OR v_event.resource_id IS DISTINCT FROM v_staff_id::text
     OR v_event.before_values ->> 'role' IS DISTINCT FROM 'sales_rep'
     OR v_event.after_values ->> 'role' IS DISTINCT FROM 'manager'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'staff role change did not retain the prior and new role';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = '{"catalog":{"view":false},"orders":{"edit":true},"unsafe":{"value":"never-copy"}}'::jsonb
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions'
        IS DISTINCT FROM '["orders.edit", "orders.view"]'::jsonb
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'custom permission update did not retain normalized effective permissions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      COALESCE(event.before_values -> 'permissions', '[]'::jsonb)
    ) AS before_permission(value)
    WHERE event.merchant_id = v_merchant_id
      AND event.resource_type = 'staff_member'
      AND (
        pg_catalog.jsonb_typeof(before_permission.value) IS DISTINCT FROM 'string'
        OR before_permission.value #>> '{}' !~ '^([*]|[a-z][a-z0-9_]{0,63})[.]([*]|[a-z][a-z0-9_]{0,63})$'
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      COALESCE(event.after_values -> 'permissions', '[]'::jsonb)
    ) AS after_permission(value)
    WHERE event.merchant_id = v_merchant_id
      AND event.resource_type = 'staff_member'
      AND (
        pg_catalog.jsonb_typeof(after_permission.value) IS DISTINCT FROM 'string'
        OR after_permission.value #>> '{}' !~ '^([*]|[a-z][a-z0-9_]{0,63})[.]([*]|[a-z][a-z0-9_]{0,63})$'
      )
  ) THEN
    RAISE EXCEPTION 'normalized permission identifier regression';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'suspended' WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.suspended'
     OR v_event.before_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'suspended'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'staff suspension did not retain the prior and new status';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'active' WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.reactivated'
     OR v_event.before_values ->> 'status' IS DISTINCT FROM 'suspended'
     OR v_event.after_values ->> 'status' IS DISTINCT FROM 'active'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'staff reactivation did not retain the prior and new status';
  END IF;

  -- Mobile admin removes a staff member by status alone. Preserve the linked
  -- target user snapshot even when the row's user_id remains unchanged.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'removed' WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.removed'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 'status-only removal did not preserve the linked target identity';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members SET status = 'active' WHERE id = v_staff_id;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET status = 'removed', user_id = NULL
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.removed'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text
     OR v_event.after_values ? 'target_user_id' THEN
    RAISE EXCEPTION 'staff removal did not retain the prior target identity without retaining a cleared one';
  END IF;

  -- This is the existing invite route's removed-to-pending re-invite shape:
  -- the prior acceptance and user link are cleared, and only safe invitation
  -- state is retained for the new pending membership.
  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET status = 'pending',
      invitation_token = 'staff-audit-token-reinvited',
      invitation_expires_at = now() + interval '7 days',
      invited_at = now(),
      accepted_at = NULL,
      user_id = NULL
  WHERE id = v_staff_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_target_id::text, true);
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
      'sub', v_target_id::text
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
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.accepted'
     OR v_event.actor_user_id IS DISTINCT FROM v_target_id
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM v_target_id::text THEN
    RAISE EXCEPTION 're-invited staff acceptance did not derive the invitee actor and target identity';
  END IF;

  SELECT count(*) INTO v_event_count_before
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  UPDATE public.staff_members
  SET status = status
  WHERE id = v_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff no-op update did not target the fixture row';
  END IF;
  UPDATE public.staff_members
  SET updated_at = updated_at + interval '1 microsecond'
  WHERE id = v_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff updated_at-only update did not target the fixture row';
  END IF;
  RESET ROLE;

  SELECT count(*) INTO v_event_count_after
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text;
  IF v_event_count_after IS DISTINCT FROM v_event_count_before THEN
    RAISE EXCEPTION 'staff no-op or updated_at-only update emitted an audit event';
  END IF;

  INSERT INTO audit_staff_access_event_counts
  SELECT 'remove-before', count(*)
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND resource_type = 'staff_member'
    AND resource_id = v_staff_id::text;
END;
$test$;

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

DO $test$
DECLARE
  v_unclassified_column_rejected boolean := false;
BEGIN
  ALTER TABLE public.staff_members
    ADD COLUMN audit_staff_access_unclassified_probe text;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '7e3f2e10-0000-4000-8000-000000000101',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', '7e3f2e10-0000-4000-8000-000000000101'
    )::text,
    true
  );
  BEGIN
    UPDATE public.staff_members
    SET audit_staff_access_unclassified_probe = 'must-be-classified'
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      IF SQLERRM IS DISTINCT FROM 'audit_staff_access_unclassified_column' THEN
        RAISE EXCEPTION 'unclassified staff column raised unexpected error: %', SQLERRM;
      END IF;
      v_unclassified_column_rejected := true;
  END;
  RESET ROLE;

  IF NOT v_unclassified_column_rejected THEN
    RAISE EXCEPTION 'unclassified staff column update was not rejected';
  END IF;
END;
$test$;

ROLLBACK;
