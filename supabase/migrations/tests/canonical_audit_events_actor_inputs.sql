-- Regressions for malformed, session-controlled actor inputs in audit triggers.

DO $test$
DECLARE
  v_merchant_id uuid := '5e3f2e10-0000-4000-8000-000000000001';
  v_actor_id uuid := '5e3f2e10-0000-4000-8000-000000000003';
  v_sqlstate text;
  v_message text;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM set_config('app.audit_actor_user_id', '', true);
  PERFORM set_config('request.jwt.claims', '{not-json', true);
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id)
    VALUES (v_merchant_id, 'malformed-jwt-claims');
    RAISE EXCEPTION 'malformed JWT claims unexpectedly wrote an audit event';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_sqlstate <> '22023' OR v_message <> 'audit_actor_claims_invalid' THEN
      RAISE;
    END IF;
  END;
  RESET ROLE;
  IF EXISTS (
    SELECT 1 FROM pg_temp.audit_event_fixture
    WHERE resource_id = 'malformed-jwt-claims'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_id = 'malformed-jwt-claims'
  ) THEN
    RAISE EXCEPTION 'malformed JWT claims left a fixture row or audit event';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_actor_id::text)::text,
    true
  );
  PERFORM set_config('app.audit_actor_user_id', 'not-a-uuid', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO pg_temp.audit_event_fixture (merchant_id, resource_id)
    VALUES (v_merchant_id, 'malformed-actor-setting');
    RAISE EXCEPTION 'malformed actor setting unexpectedly wrote an audit event';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_sqlstate <> '22023' OR v_message <> 'audit_actor_setting_invalid' THEN
      RAISE;
    END IF;
  END;
  RESET ROLE;
  IF EXISTS (
    SELECT 1 FROM pg_temp.audit_event_fixture
    WHERE resource_id = 'malformed-actor-setting'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_id = 'malformed-actor-setting'
  ) THEN
    RAISE EXCEPTION 'malformed actor setting left a fixture row or audit event';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::jsonb::text, true);
  PERFORM set_config('app.audit_actor_user_id', v_actor_id::text, true);
END;
$test$ LANGUAGE plpgsql;
