BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000101';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000102';
  v_other_merchant_id uuid := '63a63d82-0000-4000-8000-000000000103';
  v_other_order_id uuid := '63a63d82-0000-4000-8000-000000000104';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_status text;
  v_monitor_state text;
  v_next_poll_at timestamptz;
  v_unchanged_poll_count integer;
  v_current_location text;
  v_order_shipping_status text;
  v_other_order_shipping_status text;
  v_claim record;
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

  UPDATE public.shipments
  SET status = 'delivered'
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'stale-result-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'stale-result-worker',
    'in_transit',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-stale-event',
      'raw_status', 'MPT',
      'normalized_status', 'in_transit',
      'description', 'Parcel in transit',
      'occurred_at', now()::text
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
    RAISE EXCEPTION 'a stale GIGL poll must not regress delivered tracking state';
  END IF;

  UPDATE public.shipments
  SET status = 'in_transit', current_location = 'Lagos hub'
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'delivery-attempt-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'delivery-attempt-worker',
    'failed',
    'Port Harcourt hub',
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-delivery-attempt-event',
      'raw_status', 'DELIVERY_FAILED',
      'normalized_status', 'failed',
      'description', 'Delivery attempt failed',
      'location', 'Port Harcourt hub',
      'occurred_at', (now() - interval '1 hour')::text
    ))
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  SELECT state, next_poll_at INTO v_monitor_state, v_next_poll_at
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  SELECT current_location INTO v_current_location
  FROM public.shipments
  WHERE id = v_shipment_id;
  SELECT shipping_status INTO v_order_shipping_status
  FROM public.orders
  WHERE id = v_order_id;
  IF v_status IS DISTINCT FROM 'failed'
    OR v_order_shipping_status IS DISTINCT FROM 'shipped'
    OR v_monitor_state IS DISTINCT FROM 'active'
    OR v_next_poll_at IS NULL OR v_next_poll_at <= now()
    OR v_current_location IS DISTINCT FROM 'Lagos hub' THEN
    RAISE EXCEPTION 'delivery attempts must remain pollable without regressing location';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET locked_at = now(), locked_by = 'delivery-retry-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'delivery-retry-worker',
    'out_for_delivery',
    'Port Harcourt hub',
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-delivery-retry-event',
      'raw_status', 'MSHC',
      'normalized_status', 'out_for_delivery',
      'description', 'Rider is on the way',
      'location', 'Port Harcourt hub',
      'occurred_at', (now() + interval '1 minute')::text
    ))
  );
  SELECT status, current_location INTO v_status, v_current_location
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'out_for_delivery'
    OR v_current_location IS DISTINCT FROM 'Port Harcourt hub' THEN
    RAISE EXCEPTION 'a later GIGL delivery attempt must advance tracking';
  END IF;

  UPDATE public.shipments
  SET status = 'out_for_delivery', tracking_events = jsonb_build_array(
    jsonb_build_object(
      'provider_event_key', 'monitor-regression-persisted-out-for-delivery',
      'normalized_status', 'out_for_delivery',
      'occurred_at', (now() - interval '30 minutes')::text
    )
  )
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    locked_at = now(),
    locked_by = 'stale-nonterminal-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'stale-nonterminal-worker',
    'failed',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-older-failed-event',
      'raw_status', 'DELIVERY_FAILED',
      'normalized_status', 'failed',
      'description', 'Delivery attempt failed',
      'occurred_at', (now() - interval '1 hour')::text
    ))
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'out_for_delivery' THEN
    RAISE EXCEPTION 'an older higher-ranked GIGL status must not regress tracking';
  END IF;

  UPDATE public.shipments
  SET status = 'in_transit'
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active',
    next_poll_at = now(),
    stopped_at = NULL,
    unchanged_poll_count = 95,
    locked_at = now(),
    locked_by = 'unchanged-poll-worker'
  WHERE shipment_id = v_shipment_id;
  INSERT INTO public.shipment_tracking_events (shipment_id, tracking_epoch_id, tracking_number, provider, provider_event_key, raw_status, normalized_status, description, occurred_at) SELECT shipment.id, monitor.tracking_epoch_id, shipment.tracking_number, 'GIGL', 'monitor-regression-unchanged-event', 'MPT', 'in_transit', 'Parcel in transit', now() FROM public.shipments AS shipment JOIN public.shipment_tracking_monitors AS monitor ON monitor.shipment_id = shipment.id WHERE shipment.id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'unchanged-poll-worker',
    'in_transit',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-unchanged-event',
      'raw_status', 'MPT',
      'normalized_status', 'in_transit',
      'description', 'Parcel in transit',
      'occurred_at', now()::text
    ))
  );
  SELECT state, next_poll_at, unchanged_poll_count
  INTO v_monitor_state, v_next_poll_at, v_unchanged_poll_count
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_monitor_state IS DISTINCT FROM 'paused'
    OR v_next_poll_at IS NULL OR v_next_poll_at <= now()
    OR v_unchanged_poll_count <> 96 THEN
    RAISE EXCEPTION 'unchanged GIGL polls must enter a resumable cooldown';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET next_poll_at = now(), locked_at = NULL, locked_by = NULL
  WHERE shipment_id = v_shipment_id;
  SELECT * INTO v_claim
  FROM public.claim_due_gigl_tracking_monitors(1, 'unchanged-resume-worker');
  IF v_claim.shipment_id IS DISTINCT FROM v_shipment_id
    OR v_claim.state IS DISTINCT FROM 'paused' THEN
    RAISE EXCEPTION 'paused GIGL monitors must be claimable after cooldown';
  END IF;
  SELECT unchanged_poll_count
  INTO v_unchanged_poll_count
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_unchanged_poll_count <> 0 THEN
    RAISE EXCEPTION 'resumed GIGL monitors must reset their unchanged poll counter';
  END IF;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'unchanged-resume-worker',
    'out_for_delivery',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'monitor-regression-resumed-event',
      'raw_status', 'MSHC',
      'normalized_status', 'out_for_delivery',
      'description', 'Rider is on the way',
      'occurred_at', now()::text
    ))
  );
  SELECT state, next_poll_at, unchanged_poll_count
  INTO v_monitor_state, v_next_poll_at, v_unchanged_poll_count
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_monitor_state IS DISTINCT FROM 'active'
    OR v_next_poll_at IS NULL OR v_next_poll_at <= now()
    OR v_unchanged_poll_count <> 0 THEN
    RAISE EXCEPTION 'a new GIGL event must resume a cooled-down monitor';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_other_merchant_id,
    'gigl-tracking-other-tenant@example.com',
    'GIGL Tracking Other Tenant',
    'gigl-tracking-other-tenant'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_other_order_id, v_other_merchant_id, 'GIGL-OTHER-TENANT-001', 1000);
  UPDATE public.orders
  SET shipping_status = 'processing'
  WHERE id = v_other_order_id;
  UPDATE public.shipments
  SET order_id = v_other_order_id, status = 'in_transit'
  WHERE id = v_shipment_id;
  SELECT shipping_status INTO v_other_order_shipping_status
  FROM public.orders
  WHERE id = v_other_order_id;
  IF v_other_order_shipping_status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'GIGL order synchronization must remain within the shipment tenant';
  END IF;
END;
$test$;

SELECT pass('tracking monitor status and cooldown invariants hold');

SELECT * FROM finish();
ROLLBACK;
