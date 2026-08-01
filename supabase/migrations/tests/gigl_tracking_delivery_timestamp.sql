BEGIN;

SELECT plan(2);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000701';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000702';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_existing_delivered_at timestamptz;
  v_observed_delivered_at timestamptz;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-delivery-timestamp-regression@example.com',
    'GIGL Delivery Timestamp Regression',
    'gigl-delivery-timestamp-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-TIMESTAMP-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-TIMESTAMP-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;
  SELECT tracking_epoch_id INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.shipments
  SET status = 'delivered', delivered_at = now() - interval '2 hours'
  WHERE id = v_shipment_id
  RETURNING delivered_at INTO v_existing_delivered_at;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      locked_at = now(), locked_by = 'delivery-timestamp-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'delivery-timestamp-worker',
    'delivered',
    NULL,
    now() - interval '3 hours',
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'stale-delivery-timestamp',
      'raw_status', 'MSHC',
      'normalized_status', 'delivered',
      'description', 'Shipment delivered',
      'occurred_at', (now() - interval '3 hours')::text
    ))
  );
  SELECT delivered_at INTO v_observed_delivered_at
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_observed_delivered_at IS DISTINCT FROM v_existing_delivered_at THEN
    RAISE EXCEPTION 'a stale GIGL delivery timestamp must not replace the persisted timestamp';
  END IF;

  UPDATE public.shipments
  SET status = 'cancelled', delivered_at = NULL
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      manual_terminal_override_at = NULL,
      locked_at = now(), locked_by = 'delivery-timestamp-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'delivery-timestamp-worker',
    'delivered',
    NULL,
    now(),
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'cancelled-delivery-timestamp',
      'raw_status', 'MSHC',
      'normalized_status', 'delivered',
      'description', 'Shipment delivered',
      'occurred_at', now()::text
    ))
  );
  SELECT delivered_at INTO v_observed_delivered_at
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_observed_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'cancelled GIGL shipments must not receive delivery metadata';
  END IF;
END;
$test$;

SELECT pass('stale GIGL delivery timestamps are ignored');
SELECT pass('GIGL delivery metadata follows the accepted lifecycle state');

SELECT * FROM finish();
ROLLBACK;
