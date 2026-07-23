-- Durable event delivery pipeline SQL regression.
BEGIN;
DO $$
DECLARE v_actor uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a430';
  v_admin_merchant uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a431';
  v_non_admin uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a432';
  v_claim record; v_event_two record; v_first record; v_route record;
  v_delivery_id uuid; v_finished boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF NOT has_function_privilege('authenticated',
    'public.replay_event_deliveries_batch_v1(uuid[],uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated platform admins lack batch replay'; END IF;
  INSERT INTO auth.users (id) VALUES (v_actor), (v_non_admin);
  INSERT INTO public.merchants (id, email, user_id, is_platform_admin)
  VALUES (v_admin_merchant, 'event-delivery-admin@example.invalid', v_actor, true);
  SELECT * INTO v_first
  FROM public.enqueue_domain_event_v1(
    'web', 'tenant_verified_client', 'sql-delivery-event-1', 'delivery-external-1',
    'analytics.add_to_cart.v1', 'analytics_event', 'delivery-external-1', NULL,
    '{}'::jsonb, '{"event_type":"add_to_cart","event_data":{}}'::jsonb,
    '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL
  );
  SELECT * INTO v_route
  FROM public.route_domain_event_v1(
    v_first.queue_message_id,
    v_first.domain_event_id,
    ARRAY['facebook', 'snapchat'],
    false,
    ARRAY['facebook']
  );
  IF v_route.delivery_count IS DISTINCT FROM 2
    OR v_route.archived IS DISTINCT FROM true OR NOT EXISTS (
    SELECT 1 FROM public.event_deliveries
    WHERE domain_event_id = v_first.domain_event_id
      AND destination = 'snapchat' AND status = 'shadowed'
  ) THEN
    RAISE EXCEPTION 'atomic routing/archive contract failed';
  END IF;
  SELECT id INTO v_delivery_id
  FROM public.event_deliveries
  WHERE domain_event_id = v_first.domain_event_id
    AND destination = 'facebook';
  UPDATE public.event_deliveries
  SET available_at = '-infinity'::timestamptz
  WHERE id = v_delivery_id;
  SELECT * INTO v_claim
  FROM public.claim_event_deliveries_v1(1, 'sql-worker', 60)
  WHERE id = v_delivery_id;
  IF v_claim.claim_token IS NULL
    OR v_claim.attempt_number IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'delivery claim contract failed';
  END IF;
  SELECT public.finish_event_delivery_v1(
    v_delivery_id, v_claim.claim_token, 'dead_letter', NULL,
    'invalid_destination_credentials', 'test failure', 401, NULL
  ) INTO v_finished;
  IF v_finished IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'claim-token completion failed';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_non_admin::text, true);
  BEGIN
    PERFORM public.replay_event_deliveries_batch_v1(
      ARRAY[v_delivery_id], v_non_admin, 'Unauthorized SQL replay');
    RAISE EXCEPTION 'non-admin batch replay unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  IF public.replay_event_deliveries_batch_v1(
    ARRAY[v_delivery_id, '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a499'::uuid],
    v_actor, 'Credential repaired in SQL regression') IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'mixed valid/invalid destination replay failed';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.event_deliveries
  SET available_at = '-infinity'::timestamptz
  WHERE id = v_delivery_id;
  SELECT * INTO v_claim
  FROM public.claim_event_deliveries_v1(1, 'sql-worker', 60)
  WHERE id = v_delivery_id;
  IF v_claim.claim_token IS NULL
    OR v_claim.attempt_number IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'replayed delivery did not receive a fresh attempt budget';
  END IF;
  SELECT public.finish_event_delivery_v1(
    v_delivery_id, v_claim.claim_token, 'delivered', NULL,
    NULL, NULL, 200, 'provider-1'
  ) INTO v_finished;
  IF v_finished IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'replayed delivery settlement failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_delivery_replays
    WHERE delivery_id = v_delivery_id AND replay_number = 1
  ) THEN
    RAISE EXCEPTION 'immutable destination replay audit missing';
  END IF;
  SELECT * INTO v_event_two
  FROM public.enqueue_domain_event_v1(
    'web', 'tenant_verified_client', 'sql-delivery-event-2', 'delivery-external-2',
    'analytics.add_to_cart.v1', 'analytics_event', 'delivery-external-2', NULL,
    '{}'::jsonb, '{"event_type":"add_to_cart","event_data":{}}'::jsonb,
    '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL
  );
  PERFORM public.route_domain_event_v1(
    v_event_two.queue_message_id, v_event_two.domain_event_id,
    ARRAY['tiktok'], false, ARRAY['tiktok']
  );
  SELECT id INTO v_delivery_id FROM public.event_deliveries
  WHERE domain_event_id = v_event_two.domain_event_id;
  UPDATE public.event_deliveries
  SET available_at = '-infinity'::timestamptz
  WHERE id = v_delivery_id;
  PERFORM * FROM public.claim_event_deliveries_v1(1, 'stale-worker', 10);
  UPDATE public.event_deliveries
  SET claimed_at = now() - interval '2 minutes'
  WHERE id = v_delivery_id;
  SELECT * INTO v_claim
  FROM public.claim_event_deliveries_v1(1, 'recovery-worker', 10)
  WHERE id = v_delivery_id;
  IF v_claim.claim_token IS NULL
    OR v_claim.attempt_number IS DISTINCT FROM 2 OR NOT EXISTS (
    SELECT 1 FROM public.event_delivery_attempts
    WHERE delivery_id = v_delivery_id
      AND attempt_number = 1
      AND error_code = 'lease_expired'
  ) THEN
    RAISE EXCEPTION 'stale lease recovery audit failed';
  END IF;
END;
$$;
ROLLBACK;
