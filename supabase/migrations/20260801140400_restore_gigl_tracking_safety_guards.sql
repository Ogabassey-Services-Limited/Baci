-- Restore the retryable-failure order guard and suppress notifications that
-- became obsolete when a shipment was manually moved to a terminal state.

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
      OR orders.shipping_status NOT IN ('shipped', 'delivered')
    );
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

CREATE OR REPLACE FUNCTION private.activate_gigl_tracking_monitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.provider IS NOT DISTINCT FROM OLD.provider
     AND NULLIF(btrim(NEW.tracking_number), '') IS NOT DISTINCT FROM NULLIF(btrim(OLD.tracking_number), '')
     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN
    IF NEW.order_id IS NOT NULL THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(NEW.order_id::text, 0)
      );
    END IF;

    IF NEW.provider = 'GIGL'
       AND NEW.status IN ('delivered', 'cancelled', 'failed', 'returned')
       AND OLD.status NOT IN ('delivered', 'cancelled', 'failed', 'returned') THEN
      UPDATE public.shipment_tracking_notification_outbox AS outbox
      SET status = 'skipped', skipped_at = now(),
          skip_reason = 'tracking_terminal_override',
          locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE outbox.shipment_id = NEW.id
        AND (
          outbox.status = 'pending'
          OR (
            outbox.status = 'processing'
            AND outbox.delivery_started_at IS NULL
          )
        );

      UPDATE public.shipment_tracking_monitors
      SET state = 'final_poll', next_poll_at = now(), stopped_at = NULL, updated_at = now()
      WHERE shipment_id = NEW.id AND state IN ('active', 'paused', 'final_poll');
    ELSIF NEW.provider = 'GIGL'
       AND OLD.status IN ('delivered', 'cancelled', 'failed', 'returned')
       AND NEW.status NOT IN ('delivered', 'cancelled', 'failed', 'returned') THEN
      UPDATE public.shipment_tracking_monitors
      SET state = 'active', next_poll_at = now(), stopped_at = NULL, updated_at = now()
      WHERE shipment_id = NEW.id
        AND state IN ('terminal', 'final_poll')
        AND NOT EXISTS (
          SELECT 1
          FROM public.shipment_tracking_monitors AS competing_monitor
          WHERE competing_monitor.order_id = NEW.order_id
            AND competing_monitor.shipment_id <> NEW.id
            AND competing_monitor.state IN ('active', 'paused', 'final_poll')
        );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.shipment_tracking_notification_outbox
    SET status = 'skipped', skipped_at = now(), skip_reason = 'tracking_identity_changed',
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE shipment_id = NEW.id
      AND (
        status = 'pending'
        OR (status = 'processing' AND delivery_started_at IS NULL)
      );
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'skipped', skipped_at = now(), skip_reason = 'tracking_identity_changed',
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE (
        outbox.status = 'pending'
        OR (outbox.status = 'processing' AND outbox.delivery_started_at IS NULL)
      )
      AND EXISTS (
        SELECT 1 FROM public.shipment_tracking_monitors AS monitor
        WHERE monitor.shipment_id = outbox.shipment_id
          AND monitor.order_id = NEW.order_id
          AND monitor.shipment_id <> NEW.id
          AND monitor.tracking_timeline_generation < NEW.tracking_timeline_generation
      );

    UPDATE public.shipment_tracking_monitors AS monitor
    SET state = 'inactive', next_poll_at = NULL, stopped_at = now(),
        storefront_refresh_requested_at = NULL, storefront_refresh_lease_until = NULL,
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE monitor.order_id = NEW.order_id
      AND monitor.shipment_id <> NEW.id
      AND monitor.tracking_timeline_generation < NEW.tracking_timeline_generation
      AND monitor.state IN ('active', 'paused', 'final_poll');
  END IF;

  IF NEW.provider IS DISTINCT FROM 'GIGL'
     OR NULLIF(btrim(NEW.tracking_number), '') IS NULL
     OR pg_catalog.char_length(btrim(NEW.tracking_number)) > 128
     OR NEW.order_id IS NULL THEN
    UPDATE public.shipment_tracking_monitors
    SET state = 'inactive', next_poll_at = NULL, stopped_at = now(),
        storefront_refresh_requested_at = NULL, storefront_refresh_lease_until = NULL,
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE shipment_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.shipment_tracking_monitors (
    shipment_id, tracking_epoch_id, order_id, tracking_timeline_generation,
    provider, tracking_number, state, next_poll_at, stopped_at,
    notification_events_not_before
  ) VALUES (
    NEW.id, gen_random_uuid(), NEW.order_id, NEW.tracking_timeline_generation,
    'GIGL', btrim(NEW.tracking_number),
    CASE WHEN NEW.status IN ('delivered', 'cancelled', 'failed', 'returned')
      THEN 'final_poll' ELSE 'active' END,
    now(), NULL, now()
  ) ON CONFLICT (shipment_id) DO UPDATE SET
    tracking_epoch_id = EXCLUDED.tracking_epoch_id,
    order_id = EXCLUDED.order_id,
    tracking_timeline_generation = EXCLUDED.tracking_timeline_generation,
    tracking_number = EXCLUDED.tracking_number,
    state = EXCLUDED.state,
    next_poll_at = EXCLUDED.next_poll_at,
    stopped_at = EXCLUDED.stopped_at,
    notification_events_not_before = now(),
    started_at = now(), last_polled_at = NULL, last_event_at = NULL,
    storefront_refresh_requested_at = NULL, storefront_refresh_lease_until = NULL,
    unchanged_poll_count = 0, consecutive_failures = 0, last_error = NULL,
    locked_at = NULL, locked_by = NULL, updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.activate_gigl_tracking_monitor() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.activate_gigl_tracking_monitor()
  FROM PUBLIC, anon, authenticated, service_role;
