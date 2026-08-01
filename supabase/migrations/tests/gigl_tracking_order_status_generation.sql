BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000501';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000502';
  v_old_shipment_id uuid;
  v_current_shipment_id uuid;
  v_old_generation integer;
  v_current_generation integer;
  v_attacker_merchant_id uuid := '63a63d82-0000-4000-8000-000000000503';
  v_attacker_order_id uuid := '63a63d82-0000-4000-8000-000000000504';
  v_poisoned_shipment_id uuid;
  v_poisoned_generation integer;
  v_order_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'gigl-generation-regression@example.com',
    'GIGL Generation Regression',
    'gigl-generation-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'GIGL-GENERATION-001', 1000);
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-GENERATION-OLD',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id, tracking_timeline_generation
    INTO v_old_shipment_id, v_old_generation;
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_order_id, v_merchant_id, 'GIGL', 'GIGL-GENERATION-CURRENT',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id, tracking_timeline_generation
    INTO v_current_shipment_id, v_current_generation;

  IF v_current_generation <= v_old_generation THEN
    RAISE EXCEPTION 'replacement shipment must have a newer tracking generation';
  END IF;

  UPDATE public.shipments
  SET status = 'in_transit'
  WHERE id = v_current_shipment_id;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_attacker_merchant_id,
    'gigl-generation-attacker@example.com',
    'GIGL Generation Attacker',
    'gigl-generation-attacker'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (
    v_attacker_order_id, v_attacker_merchant_id,
    'GIGL-GENERATION-ATTACKER-001', 1000
  );
  INSERT INTO public.shipments (
    order_id, merchant_id, provider, tracking_number,
    sender_address, receiver_address, items
  ) VALUES (
    v_attacker_order_id, v_attacker_merchant_id, 'GIGL',
    'GIGL-GENERATION-POISONED', '{}', '{}', '[]'
  ) RETURNING id INTO v_poisoned_shipment_id;
  UPDATE public.shipments
  SET order_id = v_order_id
  WHERE id = v_poisoned_shipment_id
  RETURNING tracking_timeline_generation INTO v_poisoned_generation;
  IF v_poisoned_generation <= v_current_generation THEN
    RAISE EXCEPTION 'poisoned shipment must be newer than the victim shipment';
  END IF;

  UPDATE public.shipments
  SET status = 'delivered'
  WHERE id = v_current_shipment_id;
  UPDATE public.shipments
  SET status = 'in_transit', last_tracked_at = now()
  WHERE id = v_old_shipment_id;
  SELECT shipping_status INTO v_order_status
  FROM public.orders
  WHERE id = v_order_id;
  IF v_order_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'an unowned newer GIGL shipment must not block the victim order';
  END IF;
END;
$test$;

SELECT pass('unowned GIGL generations cannot block tenant order status');

SELECT * FROM finish();
ROLLBACK;
