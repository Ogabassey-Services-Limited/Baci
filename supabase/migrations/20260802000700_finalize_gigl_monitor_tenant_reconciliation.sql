-- Reconcile GIGL monitor ownership after either side of an order/shipment
-- tenant move. The newest eligible shipment is the only live monitor.

CREATE OR REPLACE FUNCTION private.reconcile_gigl_monitor_tenant(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_merchant_id uuid;
  v_shipment_id uuid;
  v_tracking_generation integer;
  v_tracking_number text;
  v_status text;
BEGIN
  SELECT order_row.merchant_id
  INTO v_order_merchant_id
  FROM public.orders AS order_row
  WHERE order_row.id = p_order_id;

  SELECT shipment.id, shipment.tracking_timeline_generation,
    btrim(shipment.tracking_number), shipment.status
  INTO v_shipment_id, v_tracking_generation, v_tracking_number, v_status
  FROM public.shipments AS shipment
  WHERE shipment.order_id = p_order_id
    AND v_order_merchant_id IS NOT NULL
    AND shipment.merchant_id = v_order_merchant_id
    AND shipment.provider = 'GIGL'
    AND NULLIF(btrim(shipment.tracking_number), '') IS NOT NULL
    AND pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128
  ORDER BY shipment.tracking_timeline_generation DESC,
    shipment.created_at DESC, shipment.id DESC
  LIMIT 1;

  -- Any undispatched row carrying another tenant's identity is unsafe even if
  -- the shipment was moved before the order. Do this before reactivating.
  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET status = 'skipped', skipped_at = now(),
      skip_reason = 'tracking_tenant_changed',
      locked_at = NULL, locked_by = NULL, updated_at = now()
  WHERE outbox.order_id = p_order_id
    AND (
      outbox.merchant_id IS DISTINCT FROM v_order_merchant_id
      OR EXISTS (
        SELECT 1
        FROM public.shipments AS shipment
        WHERE shipment.id = outbox.shipment_id
          AND (
            shipment.order_id IS DISTINCT FROM p_order_id
            OR shipment.merchant_id IS DISTINCT FROM v_order_merchant_id
          )
      )
    )
    AND (
      outbox.status = 'pending'
      OR (
        outbox.status = 'processing'
        AND outbox.delivery_started_at IS NULL
      )
    );

  -- Deactivate every competitor before the upsert so the partial unique index
  -- cannot observe two live epochs during a bulk tenant update.
  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = 'inactive', next_poll_at = NULL, stopped_at = now(),
      last_error = 'tracking_tenant_changed',
      manual_terminal_override_at = NULL,
      storefront_refresh_requested_at = NULL,
      storefront_refresh_lease_until = NULL,
      locked_at = NULL, locked_by = NULL, updated_at = now()
  WHERE monitor.order_id = p_order_id
    AND (
      v_shipment_id IS NULL
      OR monitor.shipment_id IS DISTINCT FROM v_shipment_id
    )
    AND monitor.state IN ('active', 'paused', 'final_poll');

  IF v_shipment_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.shipment_tracking_monitors (
    shipment_id, tracking_epoch_id, order_id, tracking_timeline_generation,
    provider, tracking_number, state, next_poll_at, stopped_at,
    notification_events_not_before
  ) VALUES (
    v_shipment_id, gen_random_uuid(), p_order_id, v_tracking_generation,
    'GIGL', v_tracking_number,
    CASE WHEN v_status IN ('delivered', 'cancelled', 'failed', 'returned')
      THEN 'final_poll' ELSE 'active' END,
    now(), NULL, now()
  ) ON CONFLICT (shipment_id) DO UPDATE SET
    tracking_epoch_id = EXCLUDED.tracking_epoch_id,
    order_id = EXCLUDED.order_id,
    tracking_timeline_generation = EXCLUDED.tracking_timeline_generation,
    tracking_number = EXCLUDED.tracking_number,
    state = EXCLUDED.state,
    next_poll_at = EXCLUDED.next_poll_at,
    stopped_at = NULL,
    notification_events_not_before = now(),
    started_at = now(), last_polled_at = NULL, last_event_at = NULL,
    storefront_refresh_requested_at = NULL,
    storefront_refresh_lease_until = NULL,
    unchanged_poll_count = 0, consecutive_failures = 0, last_error = NULL,
    locked_at = NULL, locked_by = NULL, updated_at = now();
END;
$$;

ALTER FUNCTION private.reconcile_gigl_monitor_tenant(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.reconcile_gigl_monitor_tenant(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.revalidate_gigl_monitor_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.id::text, 0)
    );
    PERFORM private.reconcile_gigl_monitor_tenant(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_order_tenant() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_order_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.revalidate_gigl_monitor_shipment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'skipped', skipped_at = now(),
        skip_reason = 'tracking_tenant_changed',
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE outbox.shipment_id = NEW.id
      AND (
        outbox.status = 'pending'
        OR (
          outbox.status = 'processing'
          AND outbox.delivery_started_at IS NULL
        )
      );

    IF NEW.order_id IS NOT NULL THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(NEW.order_id::text, 0)
      );
      PERFORM private.reconcile_gigl_monitor_tenant(NEW.order_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_shipment_tenant() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_shipment_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.revalidate_gigl_monitor_shipment_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN
    RETURN NEW;
  END IF;

  -- Lock both affected orders in UUID order so concurrent moves cannot leave
  -- either order with a stale monitor or undispatched outbox row.
  IF OLD.order_id IS NOT NULL
    AND (NEW.order_id IS NULL OR OLD.order_id < NEW.order_id) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(OLD.order_id::text, 0)
    );
  END IF;
  IF NEW.order_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.order_id::text, 0)
    );
  END IF;
  IF OLD.order_id IS NOT NULL
    AND NEW.order_id IS NOT NULL
    AND OLD.order_id > NEW.order_id THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(OLD.order_id::text, 0)
    );
  END IF;

  IF OLD.order_id IS NOT NULL THEN
    PERFORM private.reconcile_gigl_monitor_tenant(OLD.order_id);
  END IF;
  IF NEW.order_id IS NOT NULL THEN
    PERFORM private.reconcile_gigl_monitor_tenant(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.revalidate_gigl_monitor_shipment_order() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.revalidate_gigl_monitor_shipment_order()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS revalidate_gigl_monitor_order_tenant ON public.orders;
CREATE TRIGGER revalidate_gigl_monitor_order_tenant
AFTER UPDATE OF merchant_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.revalidate_gigl_monitor_order_tenant();

DROP TRIGGER IF EXISTS revalidate_gigl_monitor_shipment_tenant ON public.shipments;
CREATE TRIGGER revalidate_gigl_monitor_shipment_tenant
AFTER UPDATE OF merchant_id ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.revalidate_gigl_monitor_shipment_tenant();

DROP TRIGGER IF EXISTS revalidate_gigl_monitor_shipment_order ON public.shipments;
CREATE TRIGGER revalidate_gigl_monitor_shipment_order
AFTER UPDATE OF order_id ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.revalidate_gigl_monitor_shipment_order();

-- Repair rows created before the tenant triggers existed and recreate missing
-- monitors for currently owned, eligible GIGL shipments.
UPDATE public.shipment_tracking_notification_outbox AS outbox
SET status = 'skipped', skipped_at = now(),
    skip_reason = 'tracking_tenant_changed',
    locked_at = NULL, locked_by = NULL, updated_at = now()
FROM public.shipments AS shipment
JOIN public.orders AS order_row ON order_row.id = shipment.order_id
WHERE outbox.order_id = order_row.id
  AND outbox.shipment_id = shipment.id
  AND (
    outbox.merchant_id IS DISTINCT FROM order_row.merchant_id
    OR shipment.merchant_id IS DISTINCT FROM order_row.merchant_id
  )
  AND (
    outbox.status = 'pending'
    OR (
      outbox.status = 'processing'
      AND outbox.delivery_started_at IS NULL
    )
  );

UPDATE public.shipment_tracking_monitors AS monitor
SET state = 'inactive', next_poll_at = NULL,
    stopped_at = COALESCE(monitor.stopped_at, now()),
    last_error = 'tracking_tenant_changed',
    locked_at = NULL, locked_by = NULL, updated_at = now()
FROM public.shipments AS shipment
JOIN public.orders AS order_row ON order_row.id = shipment.order_id
WHERE monitor.shipment_id = shipment.id
  AND monitor.order_id = order_row.id
  AND shipment.merchant_id IS DISTINCT FROM order_row.merchant_id
  AND monitor.state <> 'inactive';

DO $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT DISTINCT shipment.order_id
    FROM public.shipments AS shipment
    JOIN public.orders AS order_row ON order_row.id = shipment.order_id
    LEFT JOIN public.shipment_tracking_monitors AS monitor
      ON monitor.shipment_id = shipment.id
    WHERE shipment.order_id IS NOT NULL
      AND order_row.merchant_id IS NOT NULL
      AND shipment.merchant_id = order_row.merchant_id
      AND shipment.provider = 'GIGL'
      AND NULLIF(btrim(shipment.tracking_number), '') IS NOT NULL
      AND pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128
      AND (
        monitor.shipment_id IS NULL
        OR monitor.state = 'inactive'
        OR monitor.order_id IS DISTINCT FROM shipment.order_id
        OR monitor.tracking_timeline_generation IS DISTINCT FROM
          shipment.tracking_timeline_generation
      )
  LOOP
    PERFORM private.reconcile_gigl_monitor_tenant(v_order_id);
  END LOOP;
END;
$$;
