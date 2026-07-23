-- Give each physical fulfillment attempt a durable identity. This preserves a
-- real return -> processing -> re-ship cycle while de-duplicating status
-- corrections inside the same cycle.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_notification_cycle_id uuid;

UPDATE public.orders
SET fulfillment_notification_cycle_id = gen_random_uuid()
WHERE fulfillment_notification_cycle_id IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN fulfillment_notification_cycle_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN fulfillment_notification_cycle_id SET NOT NULL;

ALTER TABLE public.order_notification_outbox
  ADD COLUMN IF NOT EXISTS fulfillment_cycle_id uuid;

-- Start every historical row with a distinct legacy identity. The latest event
-- of each type is then attached to the current order cycle unless the order is
-- already in a terminal reset state. This keeps sent de-duplication intact for
-- current shipments while isolating pre-migration work from a future re-ship.
UPDATE public.order_notification_outbox
SET fulfillment_cycle_id = gen_random_uuid()
WHERE fulfillment_cycle_id IS NULL;

WITH current_cycle_rows AS (
  SELECT ranked.id, ranked.fulfillment_notification_cycle_id
  FROM (
    SELECT
      outbox.id,
      orders.fulfillment_notification_cycle_id,
      row_number() OVER (
        PARTITION BY outbox.order_id, outbox.event_type
        ORDER BY outbox.event_sequence DESC, outbox.id DESC
      ) AS cycle_rank
    FROM public.order_notification_outbox AS outbox
    JOIN public.orders AS orders ON orders.id = outbox.order_id
    WHERE orders.shipping_status NOT IN (
      'returned',
      'failed',
      'cancelled',
      'canceled'
    )
  ) AS ranked
  WHERE ranked.cycle_rank = 1
)
UPDATE public.order_notification_outbox AS outbox
SET fulfillment_cycle_id = current_cycle_rows.fulfillment_notification_cycle_id
FROM current_cycle_rows
WHERE outbox.id = current_cycle_rows.id;

-- Rows created by the pre-cycle trigger did not carry a shipment snapshot.
-- Backfill active work before multiple cycles are allowed to coexist. Existing
-- metadata wins so already-snapshotted rows remain immutable.
UPDATE public.order_notification_outbox AS outbox
SET
  metadata = jsonb_build_object(
    'fulfillment_courier_name', orders.shipping_provider,
    'fulfillment_tracking_number', orders.tracking_number,
    'fulfillment_tracking_token', orders.tracking_token
  ) || outbox.metadata,
  updated_at = now()
FROM public.orders AS orders
WHERE outbox.order_id = orders.id
  AND outbox.event_type = 'order_shipped'
  AND outbox.status IN ('pending', 'processing');

ALTER TABLE public.order_notification_outbox
  ALTER COLUMN fulfillment_cycle_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_notification_outbox_cycle_event_unique
  ON public.order_notification_outbox (
    order_id,
    event_type,
    fulfillment_cycle_id
  );

DROP INDEX IF EXISTS public.idx_order_notification_outbox_active_event_unique;

CREATE OR REPLACE FUNCTION public.rotate_order_fulfillment_notification_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
    AND NEW.shipping_status IN ('returned', 'failed', 'cancelled', 'canceled')
    AND OLD.shipping_status NOT IN ('returned', 'failed', 'cancelled', 'canceled')
  THEN
    NEW.fulfillment_notification_cycle_id := gen_random_uuid();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_order_fulfillment_notification_cycle()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS zz_orders_rotate_fulfillment_notification_cycle
  ON public.orders;
CREATE TRIGGER zz_orders_rotate_fulfillment_notification_cycle
  BEFORE UPDATE OF shipping_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.rotate_order_fulfillment_notification_cycle();

CREATE OR REPLACE FUNCTION public.enqueue_order_fulfillment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP <> 'UPDATE'
    OR current_setting('baci.order_notification_outbox.suppress_enqueue', true) = 'true'
    OR NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status
  THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IN ('shipped', 'out_for_delivery')
    AND OLD.shipping_status NOT IN ('shipped', 'out_for_delivery', 'delivered', 'completed')
  THEN
    v_event_type := 'order_shipped';
  ELSIF NEW.shipping_status IN ('delivered', 'completed')
    AND OLD.shipping_status NOT IN ('delivered', 'completed')
  THEN
    v_event_type := 'order_delivered';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.order_notification_outbox (
    order_id,
    merchant_id,
    event_type,
    fulfillment_cycle_id,
    next_attempt_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.merchant_id,
    v_event_type,
    NEW.fulfillment_notification_cycle_id,
    now(),
    jsonb_build_object(
      'previous_shipping_status', OLD.shipping_status,
      'shipping_status', NEW.shipping_status,
      'source', 'orders_shipping_status_trigger',
      'fulfillment_courier_name', NEW.shipping_provider,
      'fulfillment_tracking_number', NEW.tracking_number,
      'fulfillment_tracking_token', NEW.tracking_token
    )
  )
  ON CONFLICT (order_id, event_type, fulfillment_cycle_id) DO UPDATE
  SET
    status = 'pending',
    attempt_count = 0,
    next_attempt_at = now(),
    locked_at = NULL,
    locked_by = NULL,
    last_error = NULL,
    skip_reason = NULL,
    skipped_at = NULL,
    dispatch_started_at = NULL,
    metadata = order_notification_outbox.metadata || EXCLUDED.metadata,
    updated_at = now()
  WHERE order_notification_outbox.status = 'failed'
    OR (
      order_notification_outbox.status = 'skipped'
      AND order_notification_outbox.skip_reason
        IS DISTINCT FROM 'delivery_outcome_unknown'
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_fulfillment_notification()
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_pending_shipment_notification_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_provider IS NOT DISTINCT FROM OLD.shipping_provider
    AND NEW.tracking_number IS NOT DISTINCT FROM OLD.tracking_number
    AND NEW.tracking_token IS NOT DISTINCT FROM OLD.tracking_token
  THEN
    RETURN NEW;
  END IF;

  UPDATE public.order_notification_outbox AS outbox
  SET
    metadata = outbox.metadata || jsonb_build_object(
      'fulfillment_courier_name', NEW.shipping_provider,
      'fulfillment_tracking_number', NEW.tracking_number,
      'fulfillment_tracking_token', NEW.tracking_token
    ),
    updated_at = now()
  WHERE outbox.order_id = NEW.id
    AND outbox.event_type = 'order_shipped'
    AND outbox.fulfillment_cycle_id = NEW.fulfillment_notification_cycle_id
    AND outbox.status = 'pending'
    AND outbox.dispatch_started_at IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_pending_shipment_notification_snapshot()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_refresh_pending_shipment_notification_snapshot
  ON public.orders;
CREATE TRIGGER orders_refresh_pending_shipment_notification_snapshot
  AFTER UPDATE OF shipping_provider, tracking_number, tracking_token
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_pending_shipment_notification_snapshot();

COMMENT ON COLUMN public.orders.fulfillment_notification_cycle_id IS
  'Durable identity for the current physical fulfillment attempt; rotated after a return, failure, or cancellation.';
COMMENT ON COLUMN public.order_notification_outbox.fulfillment_cycle_id IS
  'Fulfillment attempt identity used to de-duplicate status corrections without dropping real repeat shipments.';
