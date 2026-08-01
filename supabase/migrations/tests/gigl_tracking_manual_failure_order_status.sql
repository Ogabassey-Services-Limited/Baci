BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000201';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000202';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_order_shipping_status text;
  v_monitor_state text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-manual-failure-regression@example.com',
    'GIGL Manual Failure Regression',
    'gigl-manual-failure-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-MANUAL-FAILURE-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-MANUAL-FAILURE-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;
  SELECT tracking_epoch_id INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_order_id;

  UPDATE public.shipments
  SET status = 'in_transit', last_tracked_at = NULL
  WHERE id = v_shipment_id;
  UPDATE public.shipments
  SET status = 'failed', last_tracked_at = now()
  WHERE id = v_shipment_id;
  SELECT shipping_status INTO v_order_shipping_status
  FROM public.orders
  WHERE id = v_order_id;
  IF v_order_shipping_status IS DISTINCT FROM 'shipped' THEN
    RAISE EXCEPTION 'worker-applied failed attempt must preserve shipped order status';
  END IF;

  UPDATE public.shipments
  SET status = 'in_transit', last_tracked_at = NULL
  WHERE id = v_shipment_id;
  UPDATE public.shipments
  SET status = 'failed'
  WHERE id = v_shipment_id;
  SELECT shipping_status INTO v_order_shipping_status
  FROM public.orders
  WHERE id = v_order_id;
  IF v_order_shipping_status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'manual failed transition must update order status';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'final_poll', next_poll_at = now(),
      locked_at = now(), locked_by = 'manual-failure-final-poll-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'manual-failure-final-poll-worker',
    'in_transit',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'manual-failure-stale-transit-event',
      'raw_status', 'MPT',
      'normalized_status', 'in_transit',
      'description', 'Parcel remains in transit',
      'occurred_at', (now() - interval '1 hour')::text
    ))
  );
  SELECT state INTO v_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_monitor_state IS DISTINCT FROM 'terminal' THEN
    RAISE EXCEPTION 'manual failed final polls must remain terminal';
  END IF;
END;
$test$;

SELECT pass('manual and worker GIGL failure transitions are distinguished');

SELECT * FROM finish();
ROLLBACK;
