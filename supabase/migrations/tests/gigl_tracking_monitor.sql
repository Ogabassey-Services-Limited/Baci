BEGIN;

SELECT plan(18);

SELECT has_table('public', 'shipment_tracking_monitors');
SELECT has_table('public', 'shipment_tracking_events');
SELECT has_table('public', 'shipment_tracking_notification_outbox');
SELECT has_table('private', 'order_tracking_timeline_generations');
SELECT has_column('public', 'shipments', 'tracking_snapshot_version');
SELECT has_column('public', 'shipments', 'tracking_timeline_generation');
SELECT has_column(
  'public',
  'shipment_tracking_monitors',
  'tracking_timeline_generation'
);
SELECT col_is_pk('public', 'shipment_tracking_monitors', 'shipment_id');
SELECT has_index(
  'public',
  'shipment_tracking_events',
  'shipment_tracking_events_identity_key'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shipments'
  ),
  'public.shipments is not exposed through Postgres Changes'
);
SELECT ok(
  to_regprocedure('private.emit_shipment_tracking_wakeup(uuid)') IS NOT NULL
    AND to_regprocedure(
      'private.broadcast_shipment_tracking_wakeup()'
    ) IS NOT NULL,
  'the private empty-payload Broadcast emitter and trigger exist'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class AS relation
    WHERE relation.oid = to_regclass('realtime.messages')
      AND relation.relrowsecurity
  ),
  'realtime.messages has row-level security enabled'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger
    WHERE trigger.tgrelid = 'public.shipments'::regclass
      AND trigger.tgname = 'broadcast_shipment_tracking_wakeup'
      AND NOT trigger.tgisinternal
  ),
  'shipments owns the tracking wake-up trigger'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policy AS policy
    WHERE policy.polrelid = to_regclass('realtime.messages')
      AND policy.polname = 'authorized users receive shipment tracking wakeups'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
  ),
  'Realtime owns the permissive tracking-topic receive policy'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policy AS policy
    WHERE policy.polrelid = to_regclass('realtime.messages')
      AND policy.polname = 'shipment tracking topics require order access'
      AND policy.polcmd = 'r'
      AND NOT policy.polpermissive
  ),
  'Realtime owns the restrictive tracking-topic authorization guard'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policy AS policy
    WHERE policy.polrelid = to_regclass('realtime.messages')
      AND policy.polname = 'shipment tracking topics reject client sends'
      AND policy.polcmd = 'a'
      AND NOT policy.polpermissive
  ),
  'Realtime owns the restrictive tracking-topic client-send guard'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.shipment_tracking_monitors AS monitor
    WHERE monitor.state IN ('active', 'final_poll')
      AND monitor.notification_events_not_before IS NULL
  ),
  'active monitors have a notification eligibility cutoff'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000101';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000102';
  v_mismatch_order_id uuid := '63a63d82-0000-4000-8000-000000000103';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_tracking_event_id uuid;
  v_notification_id uuid;
  v_pending_event_id uuid;
  v_pending_notification_id uuid;
  v_newer_event_id uuid;
  v_newer_notification_id uuid;
  v_late_event_id uuid;
  v_late_notification_id uuid;
  v_processing_event_id uuid;
  v_processing_notification_id uuid;
  v_processing_newer_event_id uuid;
  v_processing_newer_notification_id uuid;
  v_claim record;
  v_dispatch_started boolean;
  v_delivery_started_at timestamptz;
  v_status text;
  v_monitor_state text;
  v_next_poll_at timestamptz;
  v_unchanged_poll_count integer;
  v_attempt_count integer;
  v_current_location text;
  v_order_shipping_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-tracking-monitor-regression@example.com',
    'GIGL Tracking Monitor Regression',
    'gigl-tracking-monitor-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-MONITOR-REGRESSION-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-MONITOR-REGRESSION-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;

  SELECT tracking_epoch_id
  INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-event', 'MAPT', 'pickup_scheduled', 'Pickup scheduled', now()
  ) RETURNING id INTO v_tracking_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id, v_tracking_event_id,
    'merchant', 'pickup_assigned'
  ) RETURNING id INTO v_notification_id;

  SELECT * INTO v_claim
  FROM public.claim_shipment_tracking_notifications(1, 'monitor-regression-worker');
  IF v_claim.id IS DISTINCT FROM v_notification_id OR v_claim.attempt_count <> 0 THEN
    RAISE EXCEPTION 'notification claim should not consume an attempt before dispatch';
  END IF;

  v_dispatch_started := public.begin_shipment_tracking_notification_dispatch(
    v_notification_id,
    'monitor-regression-worker'
  );
  SELECT status, attempt_count INTO v_status, v_attempt_count
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_notification_id;
  IF v_dispatch_started IS DISTINCT FROM true
    OR v_status IS DISTINCT FROM 'processing'
    OR v_attempt_count <> 1 THEN
    RAISE EXCEPTION 'notification dispatch start did not acquire the one delivery attempt';
  END IF;

  PERFORM public.complete_shipment_tracking_notification(
    v_notification_id,
    'monitor-regression-worker',
    'failed',
    'provider response unavailable'
  );
  SELECT status INTO v_status
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_notification_id;
  IF v_status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'a started dispatch must not return to the retry queue';
  END IF;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-pending-event', 'MAPT', 'pickup_scheduled', 'Pickup scheduled', now()
  ) RETURNING id INTO v_pending_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id, v_pending_event_id,
    'customer', 'transit_started'
  ) RETURNING id INTO v_pending_notification_id;
  SELECT * INTO v_claim
  FROM public.claim_shipment_tracking_notifications(1, 'monitor-regression-worker');
  IF v_claim.id IS DISTINCT FROM v_pending_notification_id THEN
    RAISE EXCEPTION 'expected the unstarted notification to be claimed';
  END IF;

  PERFORM public.complete_shipment_tracking_notification(
    v_pending_notification_id,
    'monitor-regression-worker',
    'failed',
    'token lookup unavailable'
  );
  SELECT status, attempt_count
  INTO v_status, v_attempt_count
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_pending_notification_id;
  IF v_status IS DISTINCT FROM 'pending' OR v_attempt_count <> 1 THEN
    RAISE EXCEPTION 'an unstarted failure must consume exactly one retry attempt';
  END IF;

END;
$test$;

SELECT pass('tracking notification dispatch claims preserve retry safety');

SELECT * FROM finish();
ROLLBACK;
