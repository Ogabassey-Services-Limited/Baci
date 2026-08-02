-- Ledger shape, ACL, and seed-state checks. Included after temporary trigger
-- setup so all later parts share one deterministic tenant fixture.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_other_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000002';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_staff_id uuid := '5e3f2e10-0000-4000-8000-000000000004';
  v_outsider_id uuid := '5e3f2e10-0000-4000-8000-000000000005';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint AS audit_constraint
    WHERE audit_constraint.conrelid = 'public.audit_events'::regclass
      AND audit_constraint.contype = 'f'
      AND pg_get_constraintdef(audit_constraint.oid) ~ '(merchant_id|actor_user_id)'
  ) OR NOT (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.audit_events'::regclass) THEN
    RAISE EXCEPTION 'audit ledger retention or force-RLS contract changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.audit_events'::regclass AND polcmd IN ('w', 'd', '*')
  ) THEN
    RAISE EXCEPTION 'audit_events must not have UPDATE or DELETE policies';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'private.write_audit_event_v1(uuid,text,text,text,text,text[],jsonb,jsonb,uuid,uuid,smallint,jsonb,uuid)'::regprocedure,
      'private.reject_audit_event_mutation_v1()'::regprocedure,
      'private.audit_event_metadata_valid_v1(jsonb)'::regprocedure,
      'private.audit_event_changed_fields_valid_v1(text[])'::regprocedure,
      'private.audit_event_json_object_valid_v1(jsonb,integer,integer)'::regprocedure
    ]) AS function_id
    CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(role_name, function_id, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'internal audit functions must not be directly executable';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_table_privilege(role_name, 'private.audit_event_writer_capabilities', 'SELECT')
       OR has_table_privilege(role_name, 'private.audit_event_writer_capabilities', 'INSERT')
       OR has_table_privilege(role_name, 'private.audit_event_writer_capabilities', 'UPDATE')
       OR has_table_privilege(role_name, 'private.audit_event_writer_capabilities', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'application roles must not access writer capabilities';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES
    (v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'canonical-audit-owner@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_staff_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'canonical-audit-staff@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_outsider_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'canonical-audit-outsider@example.com', 'test', now(),
      now(), now(), '{}'::jsonb, '{}'::jsonb);
  PERFORM set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES
    (v_merchant_id, v_actor_id, 'canonical-audit-owner-merchant@example.com',
      'Canonical Audit Owner', 'canonical-audit-owner'),
    (v_other_merchant_id, v_outsider_id, 'canonical-audit-other-merchant@example.com',
      'Canonical Audit Other', 'canonical-audit-other');
  INSERT INTO public.staff_members (merchant_id, user_id, email, name, role, permissions, status)
  VALUES (
    v_merchant_id, v_staff_id, 'canonical-audit-staff@example.com', 'Audit Staff',
    'sales_rep', '{"settings":{"view":true}}'::jsonb, 'active'
  );

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  BEGIN
    PERFORM 1 FROM public.audit_events;
    RAISE EXCEPTION 'authenticated direct audit_events SELECT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.audit_events (merchant_id, actor_type, action, resource_type, resource_id, source)
    VALUES (v_merchant_id, 'user', 'fixture.create', 'fixture_record', 'direct-authenticated', 'database');
    RAISE EXCEPTION 'authenticated direct audit_events INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF has_function_privilege(
    current_user,
    'private.write_audit_event_v1(uuid,text,text,text,text,text[],jsonb,jsonb,uuid,uuid,smallint,jsonb,uuid)'::regprocedure,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated direct audit writer EXECUTE unexpectedly granted';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  BEGIN
    PERFORM 1 FROM public.audit_events;
    RAISE EXCEPTION 'service_role direct audit_events SELECT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.audit_events (
      id, occurred_at, database_transaction_id, merchant_id, actor_user_id,
      actor_type, action, resource_type, resource_id, source
    ) VALUES (
      extensions.gen_random_uuid(), '2000-01-01T00:00:00Z', 'forged', v_merchant_id,
      v_actor_id, 'user', 'fixture.create', 'fixture_record', 'direct-service', 'database'
    );
    RAISE EXCEPTION 'service_role caller overrides unexpectedly reached audit_events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END;
$test$ LANGUAGE plpgsql;
