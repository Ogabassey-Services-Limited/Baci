BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000711';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000712';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_event_id uuid;
  v_monitor_state text;
  v_override_at timestamptz;
  v_notification_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-manual-failure-override-regression@example.com',
    'GIGL Manual Failure Override Regression',
    'gigl-manual-failure-override-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-FAILURE-OVERRIDE-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-FAILURE-OVERRIDE-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;
  SELECT tracking_epoch_id INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.shipments
  SET status = 'failed', last_tracked_at = now()
  WHERE id = v_shipment_id;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-FAILURE-OVERRIDE-001', 'GIGL',
    'manual-failure-override-event', 'DELIVERY_FAILED', 'failed',
    'Delivery attempt failed', now()
  ) RETURNING id INTO v_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_event_id, 'merchant', 'failed'
  );

  UPDATE public.shipments
  SET status = 'cancelled'
  WHERE id = v_shipment_id;

  SELECT state, manual_terminal_override_at
  INTO v_monitor_state, v_override_at
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  SELECT status INTO v_notification_status
  FROM public.shipment_tracking_notification_outbox
  WHERE tracking_event_id = v_event_id;

  IF v_monitor_state IS DISTINCT FROM 'final_poll'
    OR v_override_at IS NULL
    OR v_notification_status IS DISTINCT FROM 'skipped' THEN
    RAISE EXCEPTION 'manual terminal transitions from failed must stop GIGL retry work';
  END IF;
END;
$test$;

SELECT pass('manual terminal transitions from failed preserve override state');

SELECT * FROM finish();
ROLLBACK;
