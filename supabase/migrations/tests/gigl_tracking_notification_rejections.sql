BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000701';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000702';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_event_id uuid;
  v_notification_id uuid;
  v_claim record;
  v_started boolean;
  v_completed boolean;
  v_status text;
  v_delivery_started_at timestamptz;
  v_next_attempt_at timestamptz;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-notification-rejection-regression@example.com',
    'GIGL Notification Rejection Regression',
    'gigl-notification-rejection-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-REJECTION-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-REJECTION-001',
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
    v_shipment_id, v_tracking_epoch_id, 'GIGL-REJECTION-001', 'GIGL',
    'rejection-regression-event', 'MAPT', 'pickup_scheduled',
    'Pickup scheduled', now()
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id, v_event_id,
    'merchant', 'pickup_assigned'
  ) RETURNING id INTO v_notification_id;

  SELECT *
  INTO v_claim
  FROM public.claim_shipment_tracking_notifications(
    1, 'rejection-regression-worker'
  );
  IF v_claim.id IS DISTINCT FROM v_notification_id THEN
    RAISE EXCEPTION 'definitive rejection fixture did not claim its notification';
  END IF;

  v_started := public.begin_shipment_tracking_notification_dispatch(
    v_notification_id,
    'rejection-regression-worker'
  );
  v_completed := public.complete_shipment_tracking_notification(
    v_notification_id,
    'rejection-regression-worker',
    'rejected',
    'Expo rejected every ticket'
  );
  SELECT status, delivery_started_at, next_attempt_at
  INTO v_status, v_delivery_started_at, v_next_attempt_at
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_notification_id;

  IF v_started IS DISTINCT FROM true
    OR v_completed IS DISTINCT FROM true
    OR v_status IS DISTINCT FROM 'pending'
    OR v_delivery_started_at IS NOT NULL
    OR v_next_attempt_at <= now() THEN
    RAISE EXCEPTION 'definitive provider rejection must release a retryable notification';
  END IF;
END;
$test$;

SELECT pass('definitive GIGL notification rejections release a retryable claim');

SELECT * FROM finish();
ROLLBACK;
