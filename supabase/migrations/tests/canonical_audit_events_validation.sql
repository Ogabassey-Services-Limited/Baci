-- Writer constraint regressions, including independent bounds for both audit
-- snapshots. The caller-controlled fixture columns are intentional here.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
BEGIN
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
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, changed_fields)
    VALUES (v_merchant_id, 'oversized-field', ARRAY[repeat('x', 65)]::text[]);
    RAISE EXCEPTION 'oversized changed-field element unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, metadata)
    VALUES (v_merchant_id, 'large-metadata', jsonb_build_object('operation', repeat('x', 8193)));
    RAISE EXCEPTION 'oversized audit metadata unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, before_values)
    SELECT v_merchant_id, 'too-many-before-values',
      pg_catalog.jsonb_object_agg('field_' || field_number.value::text, pg_catalog.to_jsonb(field_number.value))
    FROM pg_catalog.generate_series(1, 65) AS field_number(value);
    RAISE EXCEPTION 'too many before_values keys unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, after_values)
    SELECT v_merchant_id, 'too-many-after-values',
      pg_catalog.jsonb_object_agg('field_' || field_number.value::text, pg_catalog.to_jsonb(field_number.value))
    FROM pg_catalog.generate_series(1, 65) AS field_number(value);
    RAISE EXCEPTION 'too many after_values keys unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, before_values)
    VALUES (v_merchant_id, 'oversized-before-values', jsonb_build_object('payload', repeat('x', 16385)));
    RAISE EXCEPTION 'oversized before_values unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id, after_values)
    VALUES (v_merchant_id, 'oversized-after-values', jsonb_build_object('payload', repeat('x', 16385)));
    RAISE EXCEPTION 'oversized after_values unexpectedly succeeded';
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
END;
$test$ LANGUAGE plpgsql;
