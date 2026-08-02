DO $test$
DECLARE
  v_event record;
  v_permissions_array_rejected boolean := false;
  v_permissions_json_null_rejected boolean := false;
  v_effective_permissions jsonb;
  v_orders_edit_granted boolean;
  v_orders_view_granted boolean;
BEGIN
  -- Runtime permission resolution deep-merges only SQL NULL with role defaults;
  -- non-object JSON would instead make jsonb_each fail later. Reject malformed
  -- direct authenticated writes before they can leave a broken membership row.
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
    SET permissions = '[]'::jsonb
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
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
    WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = NULL
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions'
        IS DISTINCT FROM '["orders.view"]'::jsonb THEN
    RAISE EXCEPTION 'SQL NULL permissions did not retain role-default audit semantics';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  SELECT public.get_staff_permissions('7e3f2e10-0000-4000-8000-000000000104'::uuid) INTO v_effective_permissions;
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = '{"orders":{"edit":"true","view":"false"}}'::jsonb
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions' IS DISTINCT FROM '["orders.edit"]'::jsonb
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'string boolean permission overrides did not retain their effective audit grant set';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000102'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000102'::uuid::text)::text,
    true
  );
  SELECT public.check_staff_permission(
    '7e3f2e10-0000-4000-8000-000000000102'::uuid,
    '7e3f2e10-0000-4000-8000-000000000103'::uuid,
    'orders',
    'edit'
  ) INTO v_orders_edit_granted;
  SELECT public.check_staff_permission(
    '7e3f2e10-0000-4000-8000-000000000102'::uuid,
    '7e3f2e10-0000-4000-8000-000000000103'::uuid,
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
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET role = 'manager'
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.role_changed'
     OR v_event.actor_user_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000101'::uuid
     OR v_event.actor_type IS DISTINCT FROM 'user'
     OR v_event.source IS DISTINCT FROM 'api'
     OR v_event.merchant_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000103'::uuid
     OR v_event.resource_type IS DISTINCT FROM 'staff_member'
     OR v_event.resource_id IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
     OR v_event.before_values ->> 'role' IS DISTINCT FROM 'sales_rep'
     OR v_event.after_values ->> 'role' IS DISTINCT FROM 'manager'
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'staff role change did not retain the prior and new role';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', '7e3f2e10-0000-4000-8000-000000000101'::uuid::text)::text,
    true
  );
  UPDATE public.staff_members
  SET permissions = '{"catalog":{"view":false},"orders":{"edit":true},"unsafe":{"value":"never-copy"}}'::jsonb
  WHERE id = '7e3f2e10-0000-4000-8000-000000000104'::uuid;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
    AND resource_type = 'staff_member'
    AND resource_id = '7e3f2e10-0000-4000-8000-000000000104'::uuid::text
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR v_event.action IS DISTINCT FROM 'staff.permissions_changed'
     OR v_event.after_values -> 'permissions'
        IS DISTINCT FROM '["orders.edit", "orders.view"]'::jsonb
     OR v_event.before_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text
     OR v_event.after_values ->> 'target_user_id' IS DISTINCT FROM '7e3f2e10-0000-4000-8000-000000000102'::uuid::text THEN
    RAISE EXCEPTION 'custom permission update did not retain normalized effective permissions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_events AS event
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      COALESCE(event.before_values -> 'permissions', '[]'::jsonb)
    ) AS before_permission(value)
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
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
    WHERE event.merchant_id = '7e3f2e10-0000-4000-8000-000000000103'::uuid
      AND event.resource_type = 'staff_member'
      AND (
        pg_catalog.jsonb_typeof(after_permission.value) IS DISTINCT FROM 'string'
        OR after_permission.value #>> '{}' !~ '^([*]|[a-z][a-z0-9_]{0,63})[.]([*]|[a-z][a-z0-9_]{0,63})$'
      )
  ) THEN
    RAISE EXCEPTION 'normalized permission identifier regression';
  END IF;
END;
$test$;
