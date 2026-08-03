BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000401';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000402';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_status text;
  v_order_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-retry-recovery-regression@example.com',
    'GIGL Retry Recovery Regression',
    'gigl-retry-recovery-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-RETRY-RECOVERY-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-RETRY-RECOVERY-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;

  SELECT tracking_epoch_id
  INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.shipments
  SET status = 'failed', last_tracked_at = now(),
      tracking_events = jsonb_build_array(jsonb_build_object(
        'provider_event_key', 'retry-recovery-failed-event',
        'raw_status', 'DELIVERY_FAILED',
        'normalized_status', 'failed',
        'description', 'Delivery attempt failed',
        'occurred_at', (now() - interval '10 minutes')::text
      ))
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      locked_at = now(), locked_by = 'retry-recovery-worker'
  WHERE shipment_id = v_shipment_id;

  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'retry-recovery-worker',
    'in_transit',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'retry-recovery-in-transit-event',
      'raw_status', 'MPT',
      'normalized_status', 'in_transit',
      'description', 'Parcel back in transit',
      'occurred_at', now()::text
    ))
  );
  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment_id;
  SELECT shipping_status INTO v_order_status FROM public.orders WHERE id = v_order_id;
  IF v_status IS DISTINCT FROM 'in_transit'
    OR v_order_status IS DISTINCT FROM 'shipped' THEN
    RAISE EXCEPTION 'a newer nonterminal GIGL scan must recover a failed shipment';
  END IF;
END;
$test$;

SELECT pass('retryable GIGL failures recover to newer nonterminal states');

SELECT * FROM finish();
ROLLBACK;
