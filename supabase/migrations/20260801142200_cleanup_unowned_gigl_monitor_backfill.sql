-- The original monitor backfill ranked shipments by order only. Deactivate any
-- monitor it created where the shipment and order belong to different tenants.

UPDATE public.shipment_tracking_monitors AS monitor
SET state = 'inactive',
  next_poll_at = NULL,
  stopped_at = COALESCE(monitor.stopped_at, now()),
  storefront_refresh_requested_at = NULL,
  storefront_refresh_lease_until = NULL,
  locked_at = NULL,
  locked_by = NULL,
  updated_at = now()
FROM public.shipments AS shipment,
  public.orders AS order_row
WHERE monitor.shipment_id = shipment.id
  AND order_row.id = monitor.order_id
  AND monitor.provider = 'GIGL'
  AND shipment.merchant_id IS DISTINCT FROM order_row.merchant_id
  AND monitor.state <> 'inactive';
