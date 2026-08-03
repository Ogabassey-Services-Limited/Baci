-- Keep tenant revalidation constrained to eligible GIGL shipments and one
-- newest monitor per order so stale carrier identities cannot be resumed.

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
      last_error = 'tracking_tenant_changed',
      manual_terminal_override_at = NULL,
      storefront_refresh_requested_at = NULL,
      storefront_refresh_lease_until = NULL,
      locked_at = NULL, locked_by = NULL, updated_at = now()
  FROM public.shipments AS shipment
  WHERE monitor.order_id = NEW.id
    AND monitor.shipment_id = shipment.id
    AND shipment.merchant_id IS DISTINCT FROM NEW.merchant_id
    AND monitor.state <> 'inactive';

  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = CASE
        WHEN shipment.status IN ('delivered', 'cancelled', 'failed', 'returned')
          THEN 'final_poll'
        ELSE 'active'
      END,
      next_poll_at = now(), stopped_at = NULL,
      last_error = NULL, manual_terminal_override_at = NULL,
      notification_events_not_before = now(),
      storefront_refresh_requested_at = NULL,
      storefront_refresh_lease_until = NULL,
      locked_at = NULL, locked_by = NULL,
      consecutive_failures = 0, updated_at = now()
  FROM public.shipments AS shipment
  WHERE monitor.order_id = NEW.id
    AND monitor.shipment_id = shipment.id
    AND shipment.order_id = NEW.id
    AND shipment.merchant_id IS NOT DISTINCT FROM NEW.merchant_id
    AND shipment.provider = 'GIGL'
    AND NULLIF(btrim(shipment.tracking_number), '') IS NOT NULL
    AND pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128
    AND monitor.provider = 'GIGL'
    AND monitor.state = 'inactive'
    AND monitor.last_error = 'tracking_tenant_changed'
    AND monitor.tracking_timeline_generation = shipment.tracking_timeline_generation
    AND monitor.shipment_id = (
      SELECT candidate_shipment.id
      FROM public.shipments AS candidate_shipment
      JOIN public.shipment_tracking_monitors AS candidate_monitor
        ON candidate_monitor.shipment_id = candidate_shipment.id
       AND candidate_monitor.order_id = NEW.id
      WHERE candidate_shipment.order_id = NEW.id
        AND candidate_shipment.merchant_id IS NOT DISTINCT FROM NEW.merchant_id
        AND candidate_shipment.provider = 'GIGL'
        AND NULLIF(btrim(candidate_shipment.tracking_number), '') IS NOT NULL
        AND pg_catalog.char_length(btrim(candidate_shipment.tracking_number)) <= 128
        AND candidate_monitor.provider = 'GIGL'
        AND candidate_monitor.state = 'inactive'
        AND candidate_monitor.last_error = 'tracking_tenant_changed'
        AND candidate_monitor.tracking_timeline_generation =
          candidate_shipment.tracking_timeline_generation
      ORDER BY candidate_shipment.tracking_timeline_generation DESC,
        candidate_shipment.created_at DESC, candidate_shipment.id DESC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.shipment_tracking_monitors AS competing_monitor
      WHERE competing_monitor.order_id = NEW.id
        AND competing_monitor.shipment_id <> monitor.shipment_id
        AND competing_monitor.state IN ('active', 'paused', 'final_poll')
    );

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_order_tenant()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_order_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.revalidate_gigl_monitor_shipment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_merchant_id uuid;
BEGIN
  IF NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN
    RETURN NEW;
  END IF;

  SELECT order_row.merchant_id
  INTO v_order_merchant_id
  FROM public.orders AS order_row
  WHERE order_row.id = NEW.order_id;

  IF NEW.order_id IS NULL
     OR v_order_merchant_id IS NULL
     OR NEW.merchant_id IS DISTINCT FROM v_order_merchant_id
     OR NEW.provider IS DISTINCT FROM 'GIGL'
     OR NULLIF(btrim(NEW.tracking_number), '') IS NULL
     OR pg_catalog.char_length(btrim(NEW.tracking_number)) > 128 THEN
    UPDATE public.shipment_tracking_monitors
    SET state = 'inactive', next_poll_at = NULL, stopped_at = now(),
        last_error = 'tracking_tenant_changed',
        manual_terminal_override_at = NULL,
        storefront_refresh_requested_at = NULL,
        storefront_refresh_lease_until = NULL,
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE shipment_id = NEW.id;
    RETURN NEW;
  END IF;

  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = CASE
        WHEN NEW.status IN ('delivered', 'cancelled', 'failed', 'returned')
          THEN 'final_poll'
        ELSE 'active'
      END,
      next_poll_at = now(), stopped_at = NULL,
      last_error = NULL, manual_terminal_override_at = NULL,
      notification_events_not_before = now(),
      storefront_refresh_requested_at = NULL,
      storefront_refresh_lease_until = NULL,
      locked_at = NULL, locked_by = NULL,
      consecutive_failures = 0, updated_at = now()
  WHERE monitor.shipment_id = NEW.id
    AND monitor.order_id = NEW.order_id
    AND monitor.provider = 'GIGL'
    AND monitor.state = 'inactive'
    AND monitor.last_error = 'tracking_tenant_changed'
    AND monitor.tracking_timeline_generation = NEW.tracking_timeline_generation
    AND monitor.shipment_id = (
      SELECT candidate_shipment.id
      FROM public.shipments AS candidate_shipment
      JOIN public.shipment_tracking_monitors AS candidate_monitor
        ON candidate_monitor.shipment_id = candidate_shipment.id
       AND candidate_monitor.order_id = NEW.order_id
      WHERE candidate_shipment.order_id = NEW.order_id
        AND candidate_shipment.merchant_id IS NOT DISTINCT FROM v_order_merchant_id
        AND candidate_shipment.provider = 'GIGL'
        AND NULLIF(btrim(candidate_shipment.tracking_number), '') IS NOT NULL
        AND pg_catalog.char_length(btrim(candidate_shipment.tracking_number)) <= 128
        AND candidate_monitor.provider = 'GIGL'
        AND candidate_monitor.state = 'inactive'
        AND candidate_monitor.last_error = 'tracking_tenant_changed'
        AND candidate_monitor.tracking_timeline_generation =
          candidate_shipment.tracking_timeline_generation
      ORDER BY candidate_shipment.tracking_timeline_generation DESC,
        candidate_shipment.created_at DESC, candidate_shipment.id DESC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.shipment_tracking_monitors AS competing_monitor
      WHERE competing_monitor.order_id = NEW.order_id
        AND competing_monitor.shipment_id <> NEW.id
        AND competing_monitor.state IN ('active', 'paused', 'final_poll')
    );

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_shipment_tenant()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_shipment_tenant()
  FROM PUBLIC, anon, authenticated, service_role;
