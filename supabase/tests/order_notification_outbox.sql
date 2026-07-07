-- =============================================
-- REGRESSION TEST: order fulfillment notification outbox
--   Ensures order shipping-status transitions enqueue transactional outbox rows
--   exactly once and the worker claim RPC atomically marks them processing.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/order_notification_outbox.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000801';
  v_order_id uuid := '8f0ed783-0000-4000-8000-000000000802';
  v_shipped_count integer;
  v_delivered_count integer;
  v_claimed record;
  v_processing_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'order-outbox-merchant@example.com',
    'Order Outbox Test Store',
    'order-outbox-test-store'
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    customer_email,
    shipping_status,
    payment_status,
    total
  )
  VALUES (
    v_order_id,
    v_merchant_id,
    'OUTBOX-001',
    'Outbox Customer',
    'outbox-customer@example.com',
    'processing',
    'paid',
    10000
  );

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_order_id;

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_order_id;

  SELECT count(*)::integer
  INTO v_shipped_count
  FROM public.order_notification_outbox
  WHERE order_id = v_order_id
    AND event_type = 'order_shipped';

  IF v_shipped_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one shipped outbox event, got %', v_shipped_count;
  END IF;

  UPDATE public.orders
  SET shipping_status = 'delivered'
  WHERE id = v_order_id;

  SELECT count(*)::integer
  INTO v_delivered_count
  FROM public.order_notification_outbox
  WHERE order_id = v_order_id
    AND event_type = 'order_delivered';

  IF v_delivered_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one delivered outbox event, got %', v_delivered_count;
  END IF;

  SELECT *
  INTO v_claimed
  FROM public.claim_order_notification_outbox(1, 'order-outbox-test-worker')
  LIMIT 1;

  IF v_claimed.id IS NULL
    OR v_claimed.order_id IS DISTINCT FROM v_order_id
    OR v_claimed.attempt_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'unexpected claimed outbox row: %', row_to_json(v_claimed);
  END IF;

  SELECT status
  INTO v_processing_status
  FROM public.order_notification_outbox
  WHERE id = v_claimed.id;

  IF v_processing_status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'claimed row status should be processing, got %', v_processing_status;
  END IF;
END $$;

ROLLBACK;
