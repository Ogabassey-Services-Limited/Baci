-- REGRESSION TEST: claim_order_shipment_booking must execute against a migrated
-- database and return one claim followed by an in-progress result. This directly
-- catches output-column ambiguity and attempts to bypass the lock timeout floor.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/tests/order_shipment_booking_lock.sql

BEGIN;

SELECT plan(1);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $test$
DECLARE
  v_merchant_id uuid := '63a63d82-0000-4000-8000-000000000001';
  v_order_id uuid := '63a63d82-0000-4000-8000-000000000002';
  v_first_claim record;
  v_second_claim record;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'shipment-booking-lock-regression@example.com',
    'Shipment Booking Lock Regression',
    'shipment-booking-lock-regression'
  );
  INSERT INTO public.orders (id, merchant_id, order_number, total)
  VALUES (v_order_id, v_merchant_id, 'LOCK-REGRESSION-001', 1000);

  SELECT * INTO v_first_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    '63a63d82-0000-4000-8000-000000000003',
    900
  );
  SELECT * INTO v_second_claim
  FROM public.claim_order_shipment_booking(
    v_order_id,
    v_merchant_id,
    '63a63d82-0000-4000-8000-000000000004',
    0
  );

  IF v_first_claim.claimed IS DISTINCT FROM true
    OR v_second_claim.claimed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'shipment booking claim did not preserve lock ownership';
  END IF;
END;
$test$;

SELECT pass('claim_order_shipment_booking executes and retains its first lock');
SELECT * FROM finish();

ROLLBACK;
