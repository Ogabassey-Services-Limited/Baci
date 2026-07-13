-- Allow a fulfillment event to notify again after the prior outbox row is
-- terminal. This preserves queue de-duplication for active rows while supporting
-- real re-ship/re-deliver flows such as shipped -> returned -> shipped.

ALTER TABLE public.order_notification_outbox
  DROP CONSTRAINT IF EXISTS order_notification_outbox_unique_event;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_notification_outbox_active_event_unique
  ON public.order_notification_outbox (order_id, event_type)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.enqueue_order_fulfillment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status = 'shipped' THEN
    v_event_type := 'order_shipped';
  ELSIF NEW.shipping_status = 'delivered' THEN
    v_event_type := 'order_delivered';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.order_notification_outbox (
    order_id,
    merchant_id,
    event_type,
    next_attempt_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.merchant_id,
    v_event_type,
    now(),
    jsonb_build_object(
      'previous_shipping_status', OLD.shipping_status,
      'shipping_status', NEW.shipping_status,
      'source', 'orders_shipping_status_trigger'
    )
  )
  ON CONFLICT (order_id, event_type)
    WHERE status IN ('pending', 'processing')
    DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_fulfillment_notification() FROM PUBLIC;
