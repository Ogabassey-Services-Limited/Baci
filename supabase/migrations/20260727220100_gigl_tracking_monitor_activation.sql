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
    WHERE shipment_id = NEW.id AND status = 'pending';
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'skipped', skipped_at = now(), skip_reason = 'tracking_identity_changed',
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE outbox.status = 'pending'
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

DROP TRIGGER IF EXISTS activate_gigl_tracking_monitor ON public.shipments;
CREATE TRIGGER activate_gigl_tracking_monitor
AFTER INSERT OR UPDATE OF tracking_number, status, provider, order_id ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.activate_gigl_tracking_monitor();

WITH ranked_shipments AS (
  SELECT shipment.*, row_number() OVER (
    PARTITION BY shipment.order_id
    ORDER BY shipment.tracking_timeline_generation DESC, shipment.created_at DESC, shipment.id DESC
  ) AS current_rank
  FROM public.shipments AS shipment
  WHERE shipment.order_id IS NOT NULL
)
INSERT INTO public.shipment_tracking_monitors (
  shipment_id, tracking_epoch_id, order_id, tracking_timeline_generation,
  provider, tracking_number, state, notification_events_not_before,
  next_poll_at, stopped_at, started_at
)
SELECT shipment.id, gen_random_uuid(), shipment.order_id,
  shipment.tracking_timeline_generation, 'GIGL', btrim(shipment.tracking_number),
  CASE WHEN shipment.status IN ('delivered', 'cancelled', 'failed', 'returned')
    THEN 'terminal' ELSE 'active' END,
  NULL,
  CASE WHEN shipment.status IN ('delivered', 'cancelled', 'failed', 'returned')
    THEN NULL ELSE now() END,
  CASE WHEN shipment.status IN ('delivered', 'cancelled', 'failed', 'returned')
    THEN now() ELSE NULL END,
  now()
FROM ranked_shipments AS shipment
WHERE shipment.provider = 'GIGL'
  AND NULLIF(btrim(shipment.tracking_number), '') IS NOT NULL
  AND pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128
  AND shipment.current_rank = 1
ON CONFLICT (shipment_id) DO NOTHING;

CREATE UNIQUE INDEX shipment_tracking_monitors_one_live_epoch_per_order_idx
ON public.shipment_tracking_monitors (order_id)
WHERE state IN ('active', 'paused', 'final_poll');
