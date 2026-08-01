BEGIN;

SELECT plan(3);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000801';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000802';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_status text;
  v_failed_at timestamptz := now();
  v_unknown_at timestamptz := v_failed_at + interval '10 minutes';
  v_recovery_at timestamptz := v_failed_at + interval '5 minutes';
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-failure-transition-regression@example.com',
    'GIGL Failure Transition Regression',
    'gigl-failure-transition-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-FAILURE-TRANSITION-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-FAILURE-TRANSITION-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;
  SELECT tracking_epoch_id INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.shipments
  SET status = 'in_transit', last_tracked_at = now()
  WHERE id = v_shipment_id;
  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      manual_terminal_override_at = NULL,
      locked_at = now(), locked_by = 'failure-transition-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id, v_tracking_epoch_id, 'failure-transition-worker',
    'failed', NULL, NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'failure-transition-failed-event',
      'raw_status', 'DELIVERY_FAILED', 'normalized_status', 'failed',
      'description', 'Delivery attempt failed', 'occurred_at', v_failed_at::text
    ))
  );
  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'a newer GIGL failure must remain visible after transit';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      locked_at = now(), locked_by = 'failure-transition-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id, v_tracking_epoch_id, 'failure-transition-worker',
    'pending', NULL, NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'failure-transition-unknown-event',
      'raw_status', 'UNRECOGNIZED_SCAN', 'normalized_status', 'pending',
      'description', 'Unrecognized carrier scan', 'occurred_at', v_unknown_at::text
    ))
  );

  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      locked_at = now(), locked_by = 'failure-transition-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id, v_tracking_epoch_id, 'failure-transition-worker',
    'in_transit', NULL, NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'failure-transition-between-events-recovery',
      'raw_status', 'MPT', 'normalized_status', 'in_transit',
      'description', 'Parcel back in transit', 'occurred_at', v_recovery_at::text
    ))
  );
  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'in_transit' THEN
    RAISE EXCEPTION 'a recovery between a failed event and newer unknown scan must replace the failure';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'active', next_poll_at = now(), stopped_at = NULL,
      manual_terminal_override_at = NULL,
      locked_at = now(), locked_by = 'failure-transition-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id, v_tracking_epoch_id, 'failure-transition-worker',
    'in_transit', NULL, NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'failure-transition-recovery-event',
      'raw_status', 'MPT', 'normalized_status', 'in_transit',
      'description', 'Parcel back in transit', 'occurred_at', now()::text
    ))
  );
  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'in_transit' THEN
    RAISE EXCEPTION 'a newer GIGL recovery must replace a failed attempt';
  END IF;
END;
$test$;

SELECT pass('GIGL failure transitions remain visible and recover correctly');
SELECT pass('newer GIGL recovery states replace retryable failures');
SELECT pass('GIGL recovery compares against the persisted failed event');

SELECT * FROM finish();
ROLLBACK;
