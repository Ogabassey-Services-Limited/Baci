BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_attacker_merchant_id uuid := '63a63d82-0000-4000-8000-000000000201';
  v_attacker_order_id uuid := '63a63d82-0000-4000-8000-000000000202';
  v_victim_merchant_id uuid := '63a63d82-0000-4000-8000-000000000203';
  v_victim_order_id uuid := '63a63d82-0000-4000-8000-000000000204';
  v_attacker_shipment_id uuid;
  v_merchant_changed_shipment_id uuid;
  v_victim_shipment_id uuid;
  v_attacker_monitor_order_id uuid;
  v_attacker_monitor_state text;
  v_merchant_changed_monitor_state text;
  v_victim_monitor_state text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES
    (v_attacker_merchant_id, 'gigl-monitor-attacker@example.com', 'GIGL Monitor Attacker', 'gigl-monitor-attacker'),
    (v_victim_merchant_id, 'gigl-monitor-victim@example.com', 'GIGL Monitor Victim', 'gigl-monitor-victim');
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES
    (v_attacker_order_id, v_attacker_merchant_id, 'GIGL-MONITOR-ATTACKER-001', 1000),
    (v_victim_order_id, v_victim_merchant_id, 'GIGL-MONITOR-VICTIM-001', 1000);

  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_victim_order_id, v_victim_merchant_id, 'GIGL', 'GIGL-MONITOR-VICTIM-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_victim_shipment_id;

  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_attacker_order_id, v_attacker_merchant_id, 'GIGL', 'GIGL-MONITOR-ATTACKER-001',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_attacker_shipment_id;

  UPDATE public.shipments
  SET order_id = v_victim_order_id, status = 'in_transit'
  WHERE id = v_attacker_shipment_id;

  SELECT state
  INTO v_victim_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_victim_shipment_id;
  SELECT order_id, state
  INTO v_attacker_monitor_order_id, v_attacker_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_attacker_shipment_id;
  IF v_victim_monitor_state IS DISTINCT FROM 'active'
    OR v_attacker_monitor_order_id IS DISTINCT FROM v_attacker_order_id
    OR v_attacker_monitor_state IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'cross-tenant shipment identity changes must not poison or retire monitors';
  END IF;

  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_attacker_order_id, v_attacker_merchant_id, 'GIGL',
    'GIGL-MONITOR-MERCHANT-CHANGE', '{}', '{}', '[]'
  ) RETURNING id INTO v_merchant_changed_shipment_id;
  UPDATE public.shipments
  SET merchant_id = v_victim_merchant_id
  WHERE id = v_merchant_changed_shipment_id;
  SELECT state INTO v_merchant_changed_monitor_state
  FROM public.shipment_tracking_monitors
  WHERE shipment_id = v_merchant_changed_shipment_id;
  IF v_merchant_changed_monitor_state IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'changing a GIGL shipment merchant must deactivate its monitor';
  END IF;
END;
$test$;

SELECT pass('GIGL monitor retirement remains tenant-scoped');

SELECT * FROM finish();
ROLLBACK;
