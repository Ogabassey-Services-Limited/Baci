BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000101';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000102';
  v_mismatch_order_id uuid := '63a63d82-0000-4000-8000-000000000103';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_pending_event_id uuid;
  v_pending_notification_id uuid;
  v_processing_event_id uuid;
  v_processing_notification_id uuid;
  v_processing_newer_event_id uuid;
  v_status text;
  v_delivery_started_at timestamptz;
  v_monitor_state text;
  v_next_poll_at timestamptz;
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

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-unstarted-processing', 'MPT', 'in_transit',
    'Parcel in transit', now() - interval '2 hours'
  ) RETURNING id INTO v_processing_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_processing_event_id, 'customer', 'delivered'
  ) RETURNING id INTO v_processing_notification_id;
  SELECT * INTO v_claim
  FROM public.claim_shipment_tracking_notifications(1, 'unstarted-processing-worker');
  IF v_claim.id IS DISTINCT FROM v_processing_notification_id THEN
    RAISE EXCEPTION 'the older unstarted processing notification should be claimed';
  END IF;
  SELECT status, delivery_started_at
  INTO v_status, v_delivery_started_at
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_processing_notification_id;
  IF v_status IS DISTINCT FROM 'processing' OR v_delivery_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'the claimed notification must remain unstarted before dispatch';
  END IF;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-unstarted-processing-newer', 'MSHC', 'delivered',
    'Shipment delivered', now() - interval '1 hour'
  ) RETURNING id INTO v_processing_newer_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_processing_newer_event_id, 'customer', 'delivered'
  );
  IF EXISTS (
    SELECT 1
    FROM public.shipment_tracking_notification_outbox
    WHERE id = v_processing_notification_id
  ) THEN
    RAISE EXCEPTION 'newer GIGL milestones must suppress unstarted processing rows';
  END IF;

  INSERT INTO public.shipment_tracking_events (
    shipment_id, tracking_epoch_id, tracking_number, provider,
    provider_event_key, raw_status, normalized_status, description, occurred_at
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, 'GIGL-MONITOR-REGRESSION-001', 'GIGL',
    'monitor-regression-identity-pending', 'MPT', 'in_transit',
    'Parcel in transit', now()
  ) RETURNING id INTO v_pending_event_id;
  INSERT INTO public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
    audience, notification_kind
  ) VALUES (
    v_shipment_id, v_tracking_epoch_id, v_order_id, v_merchant_id,
    v_pending_event_id, 'customer', 'transit_started'
  ) RETURNING id INTO v_pending_notification_id;

  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_mismatch_order_id, v_merchant_id, 'GIGL-MONITOR-REGRESSION-002', 1000);
  BEGIN
    UPDATE public.shipment_tracking_monitors
    SET order_id = v_mismatch_order_id,
      locked_at = now(),
      locked_by = 'monitor-result-worker'
    WHERE shipment_id = v_shipment_id;
    PERFORM public.apply_gigl_tracking_result(
      v_shipment_id,
      v_tracking_epoch_id,
      'monitor-result-worker',
      'picked_up',
      NULL,
      NULL,
      jsonb_build_array(jsonb_build_object(
        'provider_event_key', 'monitor-regression-mismatch-event',
        'raw_status', 'MPT',
        'normalized_status', 'picked_up',
        'description', 'Parcel collected',
        'occurred_at', now()::text
      ))
    );
    RAISE EXCEPTION 'expected a shipment identity mismatch';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'GIGL tracking shipment identity changed' THEN
      RAISE;
    END IF;
  END;

  UPDATE public.shipments
  SET tracking_number = 'GIGL-MONITOR-REGRESSION-002'
  WHERE id = v_shipment_id;
  SELECT status INTO v_status
  FROM public.shipment_tracking_notification_outbox
  WHERE id = v_pending_notification_id;
  IF v_status IS DISTINCT FROM 'skipped' THEN
    RAISE EXCEPTION 'an unstarted dispatch must be skipped after identity changes';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET order_id = v_order_id,
    state = 'active',
    next_poll_at = now(),
    locked_at = now(),
    locked_by = 'unknown-status-worker'
  WHERE shipment_id = v_shipment_id;
  IF NOT public.pause_gigl_tracking_monitor(
    v_shipment_id,
    v_tracking_epoch_id,
    'unknown-status-worker',
    'unknown provider lifecycle status'
  ) THEN
    RAISE EXCEPTION 'unknown-status monitor should be paused for retry';
  END IF;
  SELECT state, next_poll_at
  INTO v_monitor_state, v_next_poll_at
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_monitor_state IS DISTINCT FROM 'paused'
    OR v_next_poll_at IS NULL OR v_next_poll_at <= now() THEN
    RAISE EXCEPTION 'unknown-status monitors must remain retryable';
  END IF;
END;
$test$;

SELECT pass('tracking notification identity changes invalidate unstarted dispatches');

SELECT * FROM finish();
ROLLBACK;
