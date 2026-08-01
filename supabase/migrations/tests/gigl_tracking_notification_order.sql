BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000101';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000102';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_newer_event_id uuid;
  v_late_event_id uuid;
  v_terminal_event_id uuid;
  v_status text;
  v_monitor_state text;
  v_next_poll_at timestamptz;
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
    'monitor-regression-newer-notification', 'MSHC', 'out_for_delivery',
    'Rider is on the way', now()
  ) RETURNING id INTO v_newer_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_newer_event_id, 'merchant', 'out_for_delivery'
  );
  UPDATE public.shipment_tracking_notification_outbox
  SET status = 'sent', sent_at = now()
  WHERE tracking_event_id = v_newer_event_id;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-late-notification', 'MPT', 'in_transit',
    'Parcel in transit', now() - interval '1 hour'
  ) RETURNING id INTO v_late_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_late_event_id, 'merchant', 'transit_started'
  );
  IF EXISTS (
    SELECT 1
    FROM public.shipment_tracking_notification_outbox
    WHERE tracking_event_id = v_late_event_id
  ) THEN
    RAISE EXCEPTION 'late GIGL milestones must not remain pending after a newer notification';
  END IF;

  UPDATE public.shipment_tracking_notification_outbox
  SET status = 'failed',
    delivery_started_at = now(),
    sent_at = NULL,
    last_error = 'delivery outcome unknown'
  WHERE tracking_event_id = v_newer_event_id;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-failed-barrier-late-notification', 'MPT', 'in_transit',
    'Parcel in transit after failed notification attempt', now() - interval '2 hours'
  ) RETURNING id INTO v_late_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_late_event_id, 'merchant', 'pickup_en_route'
  );
  IF EXISTS (
    SELECT 1
    FROM public.shipment_tracking_notification_outbox
    WHERE tracking_event_id = v_late_event_id
  ) THEN
    RAISE EXCEPTION 'failed newer GIGL notifications must remain ordering barriers';
  END IF;

  UPDATE public.shipments
  SET status = 'delivered'
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'stale-terminal-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'stale-terminal-worker',
    'cancelled',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-stale-cancelled-event',
      'raw_status', 'CANCELLED',
      'normalized_status', 'cancelled',
      'description', 'Shipment cancelled',
      'occurred_at', (now() - interval '2 hours')::text
    ))
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  SELECT state, next_poll_at INTO v_monitor_state, v_next_poll_at
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'delivered'
    OR v_monitor_state IS DISTINCT FROM 'terminal'
    OR v_next_poll_at IS NOT NULL THEN
    RAISE EXCEPTION 'a stale GIGL terminal scan must not regress delivered state';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'new-terminal-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'new-terminal-worker',
    'returned',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-new-returned-event',
      'raw_status', 'RETURNED',
      'normalized_status', 'returned',
      'description', 'Shipment returned',
      'occurred_at', (now() + interval '1 minute')::text
    ))
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'returned' THEN
    RAISE EXCEPTION 'a genuinely newer GIGL terminal scan must advance status';
  END IF;

  UPDATE public.shipments
  SET status = 'delivered',
    tracking_events = jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-persisted-delivered-event',
      'normalized_status', 'delivered',
      'occurred_at', (now() - interval '30 minutes')::text
    ))
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'mixed-status-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'mixed-status-worker',
    'failed',
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'provider_event_key', 'monitor-regression-older-failed-event',
        'raw_status', 'DELIVERY_FAILED',
        'normalized_status', 'failed',
        'description', 'Delivery attempt failed',
        'occurred_at', (now() - interval '2 hours')::text
      ),
      jsonb_build_object(
        'provider_event_key', 'monitor-regression-newer-unknown-event',
        'raw_status', 'NEW_PROVIDER_STATUS',
        'normalized_status', 'pending',
        'description', 'Provider status pending review',
        'occurred_at', (now() - interval '10 minutes')::text
      )
    )
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'an older terminal scan must not outrank delivered because of a newer unknown scan';
  END IF;

  UPDATE public.shipments
  SET status = 'cancelled'
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'terminal-notification-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'terminal-notification-worker',
    'delivered',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-terminal-delivered-event',
      'raw_status', 'MSHC',
      'normalized_status', 'delivered',
      'description', 'Shipment delivered',
      'occurred_at', now()::text
    ))
  );
  SELECT id INTO v_terminal_event_id
  FROM public.shipment_tracking_events
  WHERE provider_event_key = 'monitor-regression-terminal-delivered-event';
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'cancelled'
    OR EXISTS (
      SELECT 1
      FROM public.shipment_tracking_notification_outbox
      WHERE tracking_event_id = v_terminal_event_id
        AND notification_kind = 'delivered'
    ) THEN
    RAISE EXCEPTION 'terminal-state protection must not enqueue a contradictory delivery notification';
  END IF;

END;
$test$;

SELECT pass('tracking notification order and terminal-state invariants hold');

SELECT * FROM finish();
ROLLBACK;
