-- The monitor updates shipments directly. Keep the customer-visible order
-- status in sync with the established manual-track and webhook behavior.

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
    AND orders.shipping_status IS DISTINCT FROM v_shipping_status;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.sync_gigl_tracking_order_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.sync_gigl_tracking_order_status()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS sync_gigl_tracking_order_status ON public.shipments;
CREATE TRIGGER sync_gigl_tracking_order_status
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.sync_gigl_tracking_order_status();
