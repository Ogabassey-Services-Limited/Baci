BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000301';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000302';
  v_shipment_id uuid;
  v_tracking_epoch_id uuid;
  v_status text;
  v_override_at timestamptz;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-manual-terminal-regression@example.com',
    'GIGL Manual Terminal Regression',
    'gigl-manual-terminal-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-MANUAL-TERMINAL-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-MANUAL-TERMINAL-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_shipment_id;

  SELECT tracking_epoch_id
  INTO v_tracking_epoch_id
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;

  UPDATE public.shipments
  SET status = 'delivered'
  WHERE id = v_shipment_id;
  SELECT manual_terminal_override_at
  INTO v_override_at
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_shipment_id;
  IF v_override_at IS NULL THEN
    RAISE EXCEPTION 'manual terminal transitions must record an override timestamp';
  END IF;

  UPDATE public.shipment_tracking_monitors
  SET state = 'final_poll', next_poll_at = now(),
      locked_at = now(), locked_by = 'manual-terminal-regression-worker'
  WHERE shipment_id = v_shipment_id;
  PERFORM public.apply_gigl_tracking_result(
    v_shipment_id,
    v_tracking_epoch_id,
    'manual-terminal-regression-worker',
    'returned',
    NULL,
    NULL,
    jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'manual-terminal-stale-returned-event',
      'raw_status', 'RETURNED',
      'normalized_status', 'returned',
      'description', 'Shipment returned',
      'occurred_at', (v_override_at - interval '1 hour')::text
    ))
  );
  SELECT status INTO v_status
  FROM public.shipments
  WHERE id = v_shipment_id;
  IF v_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'a carrier event older than a manual terminal override must not replace it';
  END IF;
END;
$test$;

SELECT pass('manual GIGL terminal overrides survive older carrier scans');

SELECT * FROM finish();
ROLLBACK;
