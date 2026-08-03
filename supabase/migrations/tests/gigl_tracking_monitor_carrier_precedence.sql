BEGIN;

SELECT plan(1);

-- The reconciliation function is private and intentionally executable only by
-- its postgres owner. Run this fixture with the database owner role.
SET LOCAL ROLE postgres;

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000601';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000602';
  v_gigl_shipment_id uuid;
  v_gigl_generation integer;
  v_topship_generation integer;
  v_monitor_state text;
  v_outbox_status text;
  v_event_id uuid;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-carrier-precedence@example.com',
    'GIGL Carrier Precedence',
    'gigl-carrier-precedence'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-CARRIER-PRECEDENCE-001', 1000);

  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-CARRIER-PRECEDENCE-OLD',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id, tracking_timeline_generation
    INTO v_gigl_shipment_id, v_gigl_generation;

  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'TOPSHIP', 'TOPSHIP-CARRIER-PRECEDENCE-NEW',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING tracking_timeline_generation INTO v_topship_generation;

  IF v_topship_generation <= v_gigl_generation THEN
    RAISE EXCEPTION 'newer carrier shipment must have a newer tracking generation';
  END IF;

  -- Reproduce the stale state that the former GIGL-only selection could
  -- resurrect after the newer carrier had superseded the old waybill.
  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      last_error = NULL
  WHERE shipment_id = v_gigl_shipment_id;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description,
    occurred_at
  )
  SELECT monitor.shipment_id, monitor.tracking_epoch_id,
    'GIGL-CARRIER-PRECEDENCE-OLD', 'GIGL',
    'gigl-carrier-precedence-pending-event', 'DELIVERED', 'delivered',
    'Old GIGL delivery event', now()
  FROM public.shipment_tracking_monitors AS monitor
  WHERE monitor.shipment_id = v_gigl_shipment_id
  RETURNING id INTO v_event_id;

  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  )
  SELECT monitor.shipment_id, monitor.tracking_epoch_id, v_order_id,
    v_merchant_id, v_event_id, 'merchant', 'delivered'
  FROM public.shipment_tracking_monitors AS monitor
  WHERE monitor.shipment_id = v_gigl_shipment_id;

  PERFORM private.reconcile_gigl_monitor_tenant(v_order_id);

  SELECT state
  INTO v_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_gigl_shipment_id;

  IF v_monitor_state IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION
      'an older GIGL monitor must stay inactive when a newer carrier supersedes it';
  END IF;

  SELECT status
  INTO v_outbox_status
  FROM public.shipment_tracking_notification_outbox
  WHERE tracking_event_id = v_event_id;
  IF v_outbox_status IS DISTINCT FROM 'skipped' THEN
    RAISE EXCEPTION
      'pending notifications from a superseded GIGL shipment must be skipped';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'terminal'
  WHERE shipment_id = v_gigl_shipment_id;
  UPDATE public.shipments
  SET status = 'delivered'
  WHERE id = v_gigl_shipment_id;
  UPDATE public.shipments
  SET status = 'in_transit'
  WHERE id = v_gigl_shipment_id;

  SELECT state
  INTO v_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_gigl_shipment_id;
  IF v_monitor_state IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION
      'a superseded GIGL monitor must not revive after terminal status recovery';
  END IF;
END;
$test$;

SELECT pass(
  'newer non-GIGL shipments prevent stale GIGL monitor reactivation'
);

SELECT * FROM finish();
ROLLBACK;
