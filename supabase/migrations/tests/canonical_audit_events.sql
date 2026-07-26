-- Regression contract for 20260726160000_create_canonical_audit_events.sql.
-- The temporary fixture is intentionally test-only: production trigger wiring
-- belongs to later phases. Everything below rolls back.

BEGIN;

CREATE TEMP TABLE audit_event_fixture (
  merchant_id uuid NOT NULL,
  merchant_label text,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{"operation":"fixture"}'::jsonb,
  changed_fields text[] NOT NULL DEFAULT ARRAY['value']::text[]
);

CREATE OR REPLACE FUNCTION pg_temp.capture_fixture_audit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.write_audit_event_v1(
    NEW.merchant_id,
    NEW.merchant_label,
    'user',
    'fixture actor',
    'fixture.create',
    'fixture_record',
    NEW.resource_id,
    NEW.changed_fields,
    NULL,
    jsonb_build_object('resource_id', NEW.resource_id),
    'database',
    NULL,
    NULL,
    1,
    NEW.metadata
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_fixture_audit_v1
  AFTER INSERT ON pg_temp.audit_event_fixture
  FOR EACH ROW EXECUTE FUNCTION pg_temp.capture_fixture_audit_v1();

GRANT INSERT ON pg_temp.audit_event_fixture TO anon, authenticated, service_role;

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_other_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000002';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_staff_id uuid := '5e3f2e10-0000-4000-8000-000000000004';
  v_outsider_id uuid := '5e3f2e10-0000-4000-8000-000000000005';
  v_first_id uuid;
  v_second_id uuid;
  v_cursor_time timestamptz;
  v_cursor_id uuid;
  v_count integer;
  v_names text;
  v_types text;
  v_tx_count integer;
BEGIN
  -- Catalog-level protection: no source FKs, no UPDATE/DELETE policies, no
  -- direct internal routine execution for application or service roles.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint
    WHERE constraint.conrelid = 'public.audit_events'::regclass
      AND constraint.contype = 'f'
      AND pg_get_constraintdef(constraint.oid) ~ '(merchant_id|actor_user_id)'
  ) THEN
    RAISE EXCEPTION 'audit_events must not retain foreign keys for merchant or actor snapshots';
  END IF;
  IF NOT (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.audit_events'::regclass) THEN
    RAISE EXCEPTION 'audit_events must FORCE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.audit_events'::regclass
      AND polcmd IN ('w', 'd', '*')
  ) THEN
    RAISE EXCEPTION 'audit_events must not have UPDATE or DELETE policies';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'private.write_audit_event_v1(uuid,text,text,text,text,text,text,text[],jsonb,jsonb,text,uuid,uuid,smallint,jsonb)'::regprocedure,
      'private.reject_audit_event_mutation_v1()'::regprocedure,
      'private.audit_event_metadata_valid_v1(jsonb)'::regprocedure
    ]) AS function_id
    CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE has_function_privilege(role_name, function_id, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'internal audit functions must not be directly executable by application roles';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES
    (v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'canonical-audit-owner@example.com', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_staff_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'canonical-audit-staff@example.com', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_outsider_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'canonical-audit-outsider@example.com', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES
    (v_merchant_id, v_actor_id, 'canonical-audit-owner-merchant@example.com', 'Canonical Audit Owner', 'canonical-audit-owner'),
    (v_other_merchant_id, v_outsider_id, 'canonical-audit-other-merchant@example.com', 'Canonical Audit Other', 'canonical-audit-other');

  INSERT INTO public.staff_members (merchant_id, user_id, email, name, role, permissions, status)
  VALUES (
    v_merchant_id, v_staff_id, 'canonical-audit-staff@example.com', 'Audit Staff', 'sales_rep',
    '{"settings":{"view":true}}'::jsonb, 'active'
  );

  -- Direct table reads and mutations are denied even to the service role.
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
  RESET ROLE;

  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
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
      extensions.gen_random_uuid(), '2000-01-01T00:00:00Z', 1, v_merchant_id, v_actor_id,
      'user', 'fixture.create', 'fixture_record', 'direct-service', 'database'
    );
    RAISE EXCEPTION 'service_role caller overrides unexpectedly reached audit_events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- The generic, service-role business trigger path attributes the JWT subject.
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES (v_merchant_id, 'Canonical Audit Owner', 'service-jwt');
  RESET ROLE;

  SELECT id INTO v_first_id
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id AND resource_id = 'service-jwt';
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE id = v_first_id
      AND actor_user_id = v_actor_id
      AND id IS NOT NULL
      AND occurred_at IS NOT NULL
      AND database_transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service-role JWT trigger event did not receive database identity or actor attribution';
  END IF;

  -- Database/migration writes fail closed without JWT or a same-transaction principal.
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('app.audit_actor_user_id', '', true);
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
    VALUES (v_merchant_id, 'Canonical Audit Owner', 'missing-actor');
    RAISE EXCEPTION 'fixture trigger accepted a mutation with no actor principal';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL;
  END;
  PERFORM set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES (v_merchant_id, 'Canonical Audit Owner', 'explicit-transaction-actor');
  RESET ROLE;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE merchant_id = v_merchant_id
      AND resource_id = 'explicit-transaction-actor'
      AND actor_user_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'same-transaction explicit database principal was not attributed';
  END IF;

  -- Validation bounds are enforced by the writer, and a failed subtransaction
  -- leaves no audit event behind.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, metadata)
    VALUES (v_merchant_id, 'unknown-metadata', '{"unknown":"no"}'::jsonb);
    RAISE EXCEPTION 'unknown audit metadata key unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, changed_fields)
    VALUES (v_merchant_id, 'too-many-fields', array_fill('field'::text, ARRAY[65]));
    RAISE EXCEPTION 'too many changed fields unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, metadata)
    VALUES (v_merchant_id, 'large-metadata', jsonb_build_object('operation', repeat('x', 8193)));
    RAISE EXCEPTION 'oversized audit metadata unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id)
    VALUES (v_merchant_id, 'rolled-back-event');
    RAISE EXCEPTION 'rollback fixture sentinel';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.audit_events WHERE resource_id = 'rolled-back-event') THEN
    RAISE EXCEPTION 'rolled-back transaction left an audit event';
  END IF;

  -- RPC validation, ownership, return shape, and deterministic cursor paging.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(NULL, 1, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'null merchant id unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  FOREACH v_count IN ARRAY ARRAY[0, 102] LOOP
    BEGIN
      PERFORM public.list_merchant_audit_events_v1(v_merchant_id, v_count, NULL, NULL, NULL, NULL);
      RAISE EXCEPTION 'invalid limit % unexpectedly succeeded', v_count;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_merchant_id, NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'null limit unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_merchant_id, 1, now(), NULL, NULL, NULL);
    RAISE EXCEPTION 'half cursor unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_merchant_id, 1, NULL, NULL, 'fixture_%', NULL);
    RAISE EXCEPTION 'wildcard filter unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_outsider_id::text, true);
  IF EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(v_merchant_id, 101, NULL, NULL, NULL, NULL)
  ) THEN
    RAISE EXCEPTION 'cross-merchant audit read unexpectedly returned rows';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  IF EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(v_merchant_id, 101, NULL, NULL, NULL, NULL)
  ) THEN
    RAISE EXCEPTION 'staff settings permission unexpectedly read owner-only audit RPC';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES
    (v_merchant_id, 'Canonical Audit Owner', 'page-a'),
    (v_merchant_id, 'Canonical Audit Owner', 'page-b');
  SELECT id, occurred_at INTO v_cursor_id, v_cursor_time
  FROM public.list_merchant_audit_events_v1(v_merchant_id, 1, NULL, NULL, 'fixture_record', 'fixture.create');
  SELECT id INTO v_second_id
  FROM public.list_merchant_audit_events_v1(v_merchant_id, 1, v_cursor_time, v_cursor_id, 'fixture_record', 'fixture.create');
  IF v_cursor_id IS NULL OR v_second_id IS NULL OR v_cursor_id = v_second_id THEN
    RAISE EXCEPTION 'cursor pagination was not deterministic';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(v_merchant_id, 101, NULL, NULL, NULL, NULL)
    WHERE id = v_first_id
  ) THEN
    RAISE EXCEPTION 'merchant owner could not read own audit event';
  END IF;
  RESET ROLE;

  CREATE TEMP TABLE audit_rpc_shape AS
  SELECT * FROM public.list_merchant_audit_events_v1(v_merchant_id, 1, NULL, NULL, NULL, NULL)
  WITH NO DATA;
  SELECT string_agg(attname, ',' ORDER BY attnum), string_agg(format_type(atttypid, atttypmod), ',' ORDER BY attnum)
  INTO v_names, v_types
  FROM pg_attribute
  WHERE attrelid = 'pg_temp.audit_rpc_shape'::regclass AND attnum > 0 AND NOT attisdropped;
  IF v_names IS DISTINCT FROM 'id,occurred_at,database_transaction_id,merchant_id,merchant_label,actor_user_id,actor_type,actor_label,action,resource_type,resource_id,changed_fields,before_values,after_values,source,correlation_id,request_id,schema_version,metadata'
     OR v_types IS DISTINCT FROM 'uuid,timestamp with time zone,bigint,uuid,text,uuid,text,text,text,text,text,text[],jsonb,jsonb,text,uuid,uuid,smallint,jsonb' THEN
    RAISE EXCEPTION 'audit reader RPC return contract changed: names=%, types=%', v_names, v_types;
  END IF;

  -- Immutability remains active even when a temporary table grant lets the
  -- bypass-RLS service role reach the row.
  GRANT SELECT, UPDATE, DELETE ON public.audit_events TO service_role;
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  BEGIN
    UPDATE public.audit_events SET action = 'fixture.changed' WHERE id = v_first_id;
    RAISE EXCEPTION 'bypass-RLS service role updated immutable audit event';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
  BEGIN
    DELETE FROM public.audit_events WHERE id = v_first_id;
    RAISE EXCEPTION 'bypass-RLS service role deleted immutable audit event';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
  RESET ROLE;

  SELECT count(DISTINCT database_transaction_id) INTO v_tx_count
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id AND resource_id IN ('page-a', 'page-b');
  IF v_tx_count <> 1 THEN
    RAISE EXCEPTION 'same-transaction audit events must share a database transaction identifier';
  END IF;

  -- Snapshot UUIDs and labels survive source deletion; child cascade paths may
  -- intentionally have no merchant label while retaining the UUID.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES
    (v_merchant_id, 'Canonical Audit Owner', 'merchant-delete-snapshot'),
    (v_merchant_id, NULL, 'child-cascade-no-label');
  RESET ROLE;
  DELETE FROM auth.users WHERE id = v_actor_id;
  DELETE FROM public.merchants WHERE id = v_merchant_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_id = 'merchant-delete-snapshot'
      AND merchant_id = v_merchant_id
      AND merchant_label = 'Canonical Audit Owner'
      AND actor_user_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'merchant or actor deletion removed immutable audit snapshots';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_id = 'child-cascade-no-label'
      AND merchant_id = v_merchant_id
      AND merchant_label IS NULL
  ) THEN
    RAISE EXCEPTION 'child cascade audit event lost its merchant UUID when label was unavailable';
  END IF;

  -- The reader is not callable by anon/service roles and refuses a missing identity.
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_other_merchant_id, 1, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'anon reader RPC execution unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_other_merchant_id, 1, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'service-role reader RPC execution unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.list_merchant_audit_events_v1(v_other_merchant_id, 1, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'missing authenticated identity unexpectedly read audit RPC';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL;
  END;
  RESET ROLE;
END;
$test$ LANGUAGE plpgsql;

ROLLBACK;
