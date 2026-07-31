-- Immutability, snapshot retention, and reader execute-ACL checks.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_other_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000002';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_first_id uuid;
  v_tx_count integer;
BEGIN
  SELECT id INTO v_first_id
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id AND resource_id = 'service-jwt';
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
  IF v_tx_count <> 1
     OR (SELECT count(*) FROM private.audit_event_writer_capabilities) <> 1 THEN
    RAISE EXCEPTION 'canonical writer transaction or capability invariant changed';
  END IF;

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
  ) OR NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_id = 'child-cascade-no-label'
      AND merchant_id = v_merchant_id
      AND merchant_label IS NULL
  ) THEN
    RAISE EXCEPTION 'source deletion removed immutable audit snapshots';
  END IF;

  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  IF has_function_privilege(
    current_user,
    'public.list_merchant_audit_events_v1(uuid,integer,timestamptz,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon reader RPC EXECUTE unexpectedly granted';
  END IF;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF has_function_privilege(
    current_user,
    'public.list_merchant_audit_events_v1(uuid,integer,timestamptz,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service-role reader RPC EXECUTE unexpectedly granted';
  END IF;
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
