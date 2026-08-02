-- Deactivate GIGL monitors when an order is reassigned to another merchant.
-- Shipment changes have their own ownership trigger, but an order-only tenant
-- change must invalidate the monitor before the next service-role poll.

CREATE OR REPLACE FUNCTION private.revalidate_gigl_monitor_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET status = 'skipped', skipped_at = now(),
      skip_reason = 'tracking_tenant_changed',
      locked_at = NULL, locked_by = NULL, updated_at = now()
  FROM public.shipments AS shipment
  WHERE outbox.order_id = NEW.id
    AND outbox.shipment_id = shipment.id
    AND shipment.merchant_id IS DISTINCT FROM NEW.merchant_id
    AND (
      outbox.status = 'pending'
      OR (
        outbox.status = 'processing'
        AND outbox.delivery_started_at IS NULL
      )
    );

  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = 'inactive', next_poll_at = NULL, stopped_at = now(),
      manual_terminal_override_at = NULL,
      storefront_refresh_requested_at = NULL,
      storefront_refresh_lease_until = NULL,
      locked_at = NULL, locked_by = NULL, updated_at = now()
  FROM public.shipments AS shipment
  WHERE monitor.order_id = NEW.id
    AND monitor.shipment_id = shipment.id
    AND shipment.merchant_id IS DISTINCT FROM NEW.merchant_id
    AND monitor.state IN ('active', 'paused', 'final_poll');

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_order_tenant()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_order_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS revalidate_gigl_monitor_order_tenant ON public.orders;
CREATE TRIGGER revalidate_gigl_monitor_order_tenant
AFTER UPDATE OF merchant_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.revalidate_gigl_monitor_order_tenant();
