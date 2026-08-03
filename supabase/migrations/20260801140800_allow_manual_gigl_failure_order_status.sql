-- Allow manual GIGL failure updates to synchronize the parent order while
-- retaining the guard for retryable carrier-applied delivery failures.

CREATE OR REPLACE FUNCTION private.sync_gigl_tracking_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shipping_status text;
BEGIN
  IF NEW.provider IS DISTINCT FROM 'GIGL'
    OR NEW.order_id IS NULL
    OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_shipping_status := CASE NEW.status
    WHEN 'pending' THEN 'pending'
    WHEN 'booked' THEN 'shipped'
    WHEN 'pickup_scheduled' THEN 'shipped'
    WHEN 'picked_up' THEN 'shipped'
    WHEN 'in_transit' THEN 'shipped'
    WHEN 'out_for_delivery' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'failed' THEN 'failed'
    WHEN 'returned' THEN 'returned'
    ELSE 'processing'
  END;

  UPDATE public.orders AS orders
  SET shipping_status = v_shipping_status, updated_at = now()
  WHERE orders.id = NEW.order_id
    AND orders.merchant_id = NEW.merchant_id
    AND orders.shipping_status IS DISTINCT FROM v_shipping_status
    AND (
      NEW.status IS DISTINCT FROM 'failed'
      OR NEW.last_tracked_at IS NOT DISTINCT FROM OLD.last_tracked_at
      OR orders.shipping_status NOT IN ('shipped', 'delivered')
    );
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.sync_gigl_tracking_order_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.sync_gigl_tracking_order_status()
  FROM PUBLIC, anon, authenticated, service_role;
