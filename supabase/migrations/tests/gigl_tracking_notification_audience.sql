BEGIN;

SELECT plan(2);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-0000-000000000601';
  v_order_id uuid := '63a63d82-0000-4000-0000-000000000602';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_stale_event_id uuid;
  v_newer_event_id uuid;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-notification-audience-regression@example.com',
    'GIGL Notification Audience Regression',
    'gigl-notification-audience-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-AUDIENCE-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-AUDIENCE-001',
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
    v_shipment_id, v_tracking_epoch_id, 'GIGL-AUDIENCE-001', 'GIGL',
    'audience-stale-delivered', 'MSHC', 'delivered', 'Delivered',
    now() - interval '2 hours'
  ) RETURNING id INTO v_stale_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_stale_event_id, 'customer', 'delivered'
  );

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-AUDIENCE-001', 'GIGL',
    'audience-newer-cancelled', 'CANCELLED', 'cancelled', 'Cancelled',
    now() - interval '1 hour'
  ) RETURNING id INTO v_newer_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_newer_event_id, 'merchant', 'cancelled'
  );

  IF EXISTS (
    SELECT 1
    FROM public.shipment_tracking_notification_outbox
    WHERE tracking_event_id = v_stale_event_id
  ) THEN
    RAISE EXCEPTION
      'a newer terminal GIGL event must suppress stale notifications for every audience';
  END IF;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-AUDIENCE-001', 'GIGL',
    'audience-stale-transit', 'MPT', 'in_transit', 'In transit',
    now() - interval '30 minutes'
  ) RETURNING id INTO v_stale_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_stale_event_id, 'customer', 'transit_started'
  );

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-AUDIENCE-001', 'GIGL',
    'audience-newer-pickup', 'MAPT', 'pickup_scheduled', 'Pickup scheduled',
    now() - interval '10 minutes'
  ) RETURNING id INTO v_newer_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_newer_event_id, 'merchant', 'pickup_assigned'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.shipment_tracking_notification_outbox
    WHERE tracking_event_id = v_stale_event_id
  ) THEN
    RAISE EXCEPTION
      'nonterminal cross-audience GIGL events must not suppress milestones';
  END IF;
END;
$test$;

SELECT pass('GIGL terminal notification suppression is audience-safe');
SELECT pass('GIGL nonterminal cross-audience milestones remain eligible');

SELECT * FROM finish();
ROLLBACK;
