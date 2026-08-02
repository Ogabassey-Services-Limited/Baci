-- Re-run monitor ownership validation when a shipment changes tenant.
-- The activation function already rejects an unowned order; this trigger
-- ensures that guard executes for merchant-only updates as well.

DROP TRIGGER IF EXISTS activate_gigl_tracking_monitor ON public.shipments;
CREATE TRIGGER activate_gigl_tracking_monitor
AFTER INSERT OR UPDATE OF tracking_number, status, provider, order_id, merchant_id
ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.activate_gigl_tracking_monitor();
