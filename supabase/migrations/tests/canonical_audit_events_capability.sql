-- Capability confinement and actor-attribution cases. The temporary trigger
-- setup and seed merchants are supplied by earlier wrapper parts.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_first_id uuid;
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION private.write_audit_event_v1(uuid, text, text, text, text, text[], jsonb, jsonb, uuid, uuid, smallint, jsonb, uuid) TO authenticated';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  BEGIN
    INSERT INTO pg_temp.audit_event_unreviewed_fixture (merchant_id, resource_id)
    VALUES (v_merchant_id, 'unreviewed-trigger');
    RAISE EXCEPTION 'unreviewed trigger unexpectedly wrote an audit event';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'audit_writer_capability_required' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO pg_temp.audit_event_attacker_fixture (merchant_id, resource_id)
    VALUES (v_merchant_id, 'attacker-trigger');
    RAISE EXCEPTION 'attacker-owned trigger unexpectedly wrote an audit event';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'audit_writer_capability_required' THEN RAISE; END IF;
  END;
  RESET ROLE;

  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role', 'sub', v_actor_id::text)::text,
    true
  );
  INSERT INTO pg_temp.audit_event_fixture (merchant_id, merchant_label, resource_id)
  VALUES (v_merchant_id, 'Canonical Audit Owner', 'service-jwt');
  RESET ROLE;

  SELECT id INTO v_first_id
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id AND resource_id = 'service-jwt';
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE id = v_first_id
      AND actor_user_id IS NULL
      AND actor_type = 'service'
      AND actor_label = 'service_role'
      AND source = 'api'
      AND occurred_at IS NOT NULL
      AND database_transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service-role JWT trigger event did not receive database identity or actor attribution';
  END IF;

  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}'::jsonb::text, true);
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
END;
$test$ LANGUAGE plpgsql;
