BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000601';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000602';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_first_event_id uuid;
  v_second_event_id uuid;
  v_failed_count integer;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-notification-attempts-regression@example.com',
    'GIGL Notification Attempts Regression',
    'gigl-notification-attempts-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-ATTEMPTS-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-ATTEMPTS-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;
  SELECT tracking_epoch_id INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-ATTEMPTS-001', 'GIGL',
    'first-failed-attempt', 'DELIVERY_FAILED', 'failed',
    'First delivery attempt failed', now() - interval '10 minutes'
  ) RETURNING id INTO v_first_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind, status, delivery_started_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_first_event_id, 'merchant', 'failed', 'failed', now()
  );

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-ATTEMPTS-001', 'GIGL',
    'second-failed-attempt', 'DELIVERY_FAILED', 'failed',
    'Second delivery attempt failed', now()
  ) RETURNING id INTO v_second_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_second_event_id, 'merchant', 'failed'
  );

  SELECT count(*) INTO v_failed_count
  FROM public.shipment_tracking_notification_outbox
  WHERE shipment_id = v_shipment_id
    AND tracking_epoch_id = v_tracking_epoch_id
    AND audience = 'merchant'
    AND notification_kind = 'failed';
  IF v_failed_count <> 2 THEN
    RAISE EXCEPTION 'distinct GIGL delivery attempts must each enqueue a failed notification';
  END IF;
END;
$test$;

SELECT pass('distinct GIGL delivery attempts retain separate notifications');

SELECT * FROM finish();
ROLLBACK;
