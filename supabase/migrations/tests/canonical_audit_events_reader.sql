-- Reader ownership, paging, return shape, and filter-index regressions.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_other_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000002';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_staff_id uuid := '5e3f2e10-0000-4000-8000-000000000004';
  v_outsider_id uuid := '5e3f2e10-0000-4000-8000-000000000005';
  v_cursor_time timestamptz;
  v_cursor_id uuid;
  v_second_id uuid;
  v_count integer;
  v_names text;
  v_types text;
BEGIN
  IF to_regclass('public.idx_audit_events_resource_type_occurred_id') IS NULL
     OR to_regclass('public.idx_audit_events_action_occurred_id') IS NULL
     OR to_regclass('public.idx_audit_events_resource_type_action_occurred_id') IS NULL THEN
    RAISE EXCEPTION 'audit reader filter indexes are missing';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM public.list_merchant_audit_events_v1(v_merchant_id, 1);
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
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  IF EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(v_merchant_id, 101, NULL, NULL, NULL, NULL)
  ) THEN
    RAISE EXCEPTION 'staff settings permission unexpectedly read owner-only audit RPC';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES
    (v_merchant_id, 'Canonical Audit Owner', 'page-a'),
    (v_merchant_id, 'Canonical Audit Owner', 'page-b');
  SELECT id, occurred_at INTO v_cursor_id, v_cursor_time
  FROM public.list_merchant_audit_events_v1(
    v_merchant_id, 1, NULL, NULL, 'fixture_record', 'fixture.create'
  );
  SELECT id INTO v_second_id
  FROM public.list_merchant_audit_events_v1(
    v_merchant_id, 1, v_cursor_time, v_cursor_id, 'fixture_record', 'fixture.create'
  );
  IF v_cursor_id IS NULL OR v_second_id IS NULL OR v_cursor_id = v_second_id THEN
    RAISE EXCEPTION 'cursor pagination was not deterministic';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(
      v_merchant_id, 101, NULL, NULL, 'fixture_record', NULL
    ) WHERE id = v_cursor_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.list_merchant_audit_events_v1(
      v_merchant_id, 101, NULL, NULL, NULL, 'fixture.create'
    ) WHERE id = v_cursor_id
  ) THEN
    RAISE EXCEPTION 'resource-type or action filter omitted a matching audit event';
  END IF;
  RESET ROLE;

  CREATE TEMP TABLE audit_rpc_shape AS
  SELECT * FROM public.list_merchant_audit_events_v1(v_merchant_id, 1, NULL, NULL, NULL, NULL)
  WITH NO DATA;
  SELECT string_agg(attname, ',' ORDER BY attnum),
    string_agg(format_type(atttypid, atttypmod), ',' ORDER BY attnum)
  INTO v_names, v_types
  FROM pg_attribute
  WHERE attrelid = 'pg_temp.audit_rpc_shape'::regclass AND attnum > 0 AND NOT attisdropped;
  IF v_names IS DISTINCT FROM 'id,occurred_at,database_transaction_id,merchant_id,merchant_label,actor_user_id,actor_type,actor_label,action,resource_type,resource_id,changed_fields,before_values,after_values,source,correlation_id,request_id,schema_version,metadata'
     OR v_types IS DISTINCT FROM 'uuid,timestamp with time zone,text,uuid,text,uuid,text,text,text,text,text,text[],jsonb,jsonb,text,uuid,uuid,smallint,jsonb' THEN
    RAISE EXCEPTION 'audit reader RPC return contract changed: names=%, types=%', v_names, v_types;
  END IF;
END;
$test$ LANGUAGE plpgsql;
