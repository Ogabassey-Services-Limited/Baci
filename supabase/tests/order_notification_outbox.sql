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
  v_import_order_id uuid := '8f0ed783-0000-4000-8000-000000000803';
  v_manual_order_id uuid := '8f0ed783-0000-4000-8000-000000000804';
  v_manual_processing_order_id uuid := '8f0ed783-0000-4000-8000-000000000805';
  v_delivered_completed_order_id uuid := '8f0ed783-0000-4000-8000-000000000806';
  v_shipped_count integer;
  v_delivered_count integer;
  v_repeat_shipped_count integer;
  v_import_outbox_count integer;
  v_manual_active_count integer;
  v_manual_status text;
  v_manual_terminal_status text;
  v_manual_updated_count integer;
  v_manual_processing_status text;
  v_delivered_completed_count integer;
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

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    customer_email,
    shipping_status,
    payment_status,
    total,
    external_source
  )
  VALUES (
    v_import_order_id,
    v_merchant_id,
    'OUTBOX-IMPORT-001',
    'Imported Customer',
    'imported-customer@example.com',
    'processing',
    'paid',
    10000,
    'bumpa'
  );

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_import_order_id;

  SELECT count(*)::integer
  INTO v_import_outbox_count
  FROM public.order_notification_outbox
  WHERE order_id = v_import_order_id;

  IF v_import_outbox_count <> 0 THEN
    RAISE EXCEPTION 'expected imported order status refresh to skip outbox enqueue, got % events',
      v_import_outbox_count;
  END IF;

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
    v_manual_order_id,
    v_merchant_id,
    'OUTBOX-MANUAL-001',
    'Manual Customer',
    'manual-customer@example.com',
    'processing',
    'paid',
    10000
  );

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_manual_order_id;

  SELECT public.complete_order_notification_outbox_manual_result(
    v_manual_order_id,
    v_merchant_id,
    'order_shipped',
    'sent',
    'manual-message-1',
    NULL
  )
  INTO v_manual_updated_count;

  IF v_manual_updated_count <> 1 THEN
    RAISE EXCEPTION 'expected manual endpoint completion to consume one active outbox row, got %',
      v_manual_updated_count;
  END IF;

  SELECT count(*)::integer
  INTO v_manual_active_count
  FROM public.order_notification_outbox
  WHERE order_id = v_manual_order_id
    AND status IN ('pending', 'processing');

  IF v_manual_active_count <> 0 THEN
    RAISE EXCEPTION 'expected manual endpoint completion to leave no active outbox rows, got %',
      v_manual_active_count;
  END IF;

  SELECT status
  INTO v_manual_status
  FROM public.order_notification_outbox
  WHERE order_id = v_manual_order_id
    AND event_type = 'order_shipped';

  IF v_manual_status IS DISTINCT FROM 'sent' THEN
    RAISE EXCEPTION 'expected manual endpoint consumed row to be sent, got %', v_manual_status;
  END IF;

  SELECT public.get_order_notification_outbox_manual_terminal_status(
    v_manual_order_id,
    v_merchant_id,
    'order_shipped'
  )
  INTO v_manual_terminal_status;

  IF v_manual_terminal_status IS DISTINCT FROM 'sent' THEN
    RAISE EXCEPTION 'expected manual terminal-state RPC to return sent, got %',
      v_manual_terminal_status;
  END IF;

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
    v_manual_processing_order_id,
    v_merchant_id,
    'OUTBOX-MANUAL-PROCESSING-001',
    'Manual Processing Customer',
    'manual-processing-customer@example.com',
    'processing',
    'paid',
    10000
  );

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_manual_processing_order_id;

  UPDATE public.order_notification_outbox
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = 'cron-worker',
    updated_at = now()
  WHERE order_id = v_manual_processing_order_id
    AND event_type = 'order_shipped';

  SELECT public.complete_order_notification_outbox_manual_result(
    v_manual_processing_order_id,
    v_merchant_id,
    'order_shipped',
    'sent',
    'manual-message-processing-1',
    NULL
  )
  INTO v_manual_updated_count;

  IF v_manual_updated_count <> 0 THEN
    RAISE EXCEPTION 'expected manual endpoint completion to leave cron-claimed rows untouched, got % updates',
      v_manual_updated_count;
  END IF;

  SELECT status
  INTO v_manual_processing_status
  FROM public.order_notification_outbox
  WHERE order_id = v_manual_processing_order_id
    AND event_type = 'order_shipped';

  IF v_manual_processing_status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'expected cron-claimed row to remain processing, got %',
      v_manual_processing_status;
  END IF;

  SELECT public.get_order_notification_outbox_manual_terminal_status(
    v_manual_processing_order_id,
    v_merchant_id,
    'order_shipped'
  )
  INTO v_manual_terminal_status;

  IF v_manual_terminal_status IS NOT NULL THEN
    RAISE EXCEPTION 'expected manual terminal-state RPC to ignore processing rows, got %',
      v_manual_terminal_status;
  END IF;

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

  UPDATE public.order_notification_outbox
  SET
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE order_id = v_order_id
    AND event_type = 'order_shipped';

  UPDATE public.orders
  SET shipping_status = 'returned'
  WHERE id = v_order_id;

  UPDATE public.orders
  SET shipping_status = 'shipped'
  WHERE id = v_order_id;

  SELECT count(*)::integer
  INTO v_repeat_shipped_count
  FROM public.order_notification_outbox
  WHERE order_id = v_order_id
    AND event_type = 'order_shipped';

  IF v_repeat_shipped_count <> 2 THEN
    RAISE EXCEPTION 'expected re-shipping after terminal outbox row to enqueue a second shipped event, got %',
      v_repeat_shipped_count;
  END IF;

  UPDATE public.orders
  SET shipping_status = 'completed'
  WHERE id = v_order_id;

  SELECT count(*)::integer
  INTO v_delivered_count
  FROM public.order_notification_outbox
  WHERE order_id = v_order_id
    AND event_type = 'order_delivered';

  IF v_delivered_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one delivered outbox event, got %', v_delivered_count;
  END IF;

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
    v_delivered_completed_order_id,
    v_merchant_id,
    'OUTBOX-DELIVERED-COMPLETED-001',
    'Delivered Completed Customer',
    'delivered-completed-customer@example.com',
    'processing',
    'paid',
    10000
  );

  UPDATE public.orders
  SET shipping_status = 'delivered'
  WHERE id = v_delivered_completed_order_id;

  UPDATE public.order_notification_outbox
  SET
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE order_id = v_delivered_completed_order_id
    AND event_type = 'order_delivered';

  UPDATE public.orders
  SET shipping_status = 'completed'
  WHERE id = v_delivered_completed_order_id;

  SELECT count(*)::integer
  INTO v_delivered_completed_count
  FROM public.order_notification_outbox
  WHERE order_id = v_delivered_completed_order_id
    AND event_type = 'order_delivered';

  IF v_delivered_completed_count <> 1 THEN
    RAISE EXCEPTION 'expected delivered->completed normalization to avoid duplicate delivered events, got %',
      v_delivered_completed_count;
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
