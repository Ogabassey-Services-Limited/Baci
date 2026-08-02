-- =====================================================================
-- REGRESSION TEST: provider shipment booking lock
--
-- USAGE:
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--     -f supabase/tests/order_shipment_booking_lock.sql
-- =====================================================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '3f761560-04b7-4f50-bf8c-96efb6830001';
  v_order_id uuid := '3f761560-04b7-4f50-bf8c-96efb6830002';
  v_first_lock uuid := '3f761560-04b7-4f50-bf8c-96efb6830003';
  v_second_lock uuid := '3f761560-04b7-4f50-bf8c-96efb6830004';
  v_claim record;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'shipment-lock-test@example.com',
    'Shipment Lock Test Store',
    'shipment-lock-test-store'
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    shipping_status,
    payment_status,
    total
  ) VALUES (
    v_order_id,
    v_merchant_id,
    'SHIPMENT-LOCK-TEST-001',
    'processing',
    'paid',
    1000
  );

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_first_lock,
    900
  );

  IF v_claim.claimed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected the first booking request to acquire the lock';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS target
    WHERE target.id = v_order_id
      AND target.shipment_booking_lock_token = v_first_lock
      AND target.shipment_booking_started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Expected the acquired lock to be persisted on the order';
  END IF;

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_second_lock,
    900
  );

  IF v_claim.claimed IS DISTINCT FROM false
     OR v_claim.shipment_id IS NOT NULL
     OR v_claim.tracking_number IS NOT NULL THEN
    RAISE EXCEPTION 'Expected a competing request to observe an in-progress lock';
  END IF;

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_second_lock,
    0
  );

  IF v_claim.claimed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected a zero-second timeout to preserve the active booking lock';
  END IF;

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_second_lock,
    NULL
  );

  IF v_claim.claimed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected a NULL timeout to preserve the active booking lock';
  END IF;

  UPDATE public.orders AS target
  SET shipment_booking_started_at = pg_catalog.now() - interval '20 minutes'
  WHERE target.id = v_order_id;

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_second_lock,
    900
  );

  IF v_claim.claimed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected a stale booking lock to be reclaimed';
  END IF;

  UPDATE public.orders AS target
  SET tracking_number = 'GIGL-BOOKED-001'
  WHERE target.id = v_order_id;

  SELECT * INTO v_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    v_first_lock,
    900
  );

  IF v_claim.claimed IS DISTINCT FROM false
     OR v_claim.tracking_number IS DISTINCT FROM 'GIGL-BOOKED-001' THEN
    RAISE EXCEPTION 'Expected an existing waybill to prevent duplicate booking';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);

  BEGIN
    PERFORM public.claim_order_shipment_booking(
      v_order_id,
      v_merchant_id,
      v_first_lock,
      900
    );
    RAISE EXCEPTION 'Expected an unauthorized booking claim to be rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$test$;

ROLLBACK;
