-- A newer shipment from another carrier supersedes every older shipment on
-- the order, including an otherwise eligible GIGL shipment.
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
  v_shipment_provider text;
BEGIN
  SELECT order_row.merchant_id
  INTO v_order_merchant_id
  FROM public.orders AS order_row
  WHERE order_row.id = p_order_id;

  -- Rank every same-tenant shipment before deciding whether GIGL may own the
  -- monitor. Filtering to GIGL first can resurrect an obsolete waybill after a
  -- newer Topship or other carrier shipment has replaced it.
  SELECT shipment.id, shipment.tracking_timeline_generation,
    btrim(shipment.tracking_number), shipment.status, shipment.provider
  INTO v_shipment_id, v_tracking_generation, v_tracking_number, v_status,
    v_shipment_provider
  FROM public.shipments AS shipment
  WHERE shipment.order_id = p_order_id
    AND v_order_merchant_id IS NOT NULL
    AND shipment.merchant_id = v_order_merchant_id
  ORDER BY shipment.tracking_timeline_generation DESC,
    shipment.created_at DESC, shipment.id DESC
  LIMIT 1;

  IF v_shipment_provider IS DISTINCT FROM 'GIGL'
    OR v_shipment_id IS NULL
    OR NULLIF(v_tracking_number, '') IS NULL
    OR pg_catalog.char_length(v_tracking_number) > 128 THEN
    v_shipment_id := NULL;
  END IF;

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

-- Repair orders touched by the previous migration's GIGL-only backfill.
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT DISTINCT shipment.order_id
    FROM public.shipments AS shipment
    JOIN public.orders AS order_row ON order_row.id = shipment.order_id
    WHERE shipment.order_id IS NOT NULL
      AND order_row.merchant_id IS NOT NULL
      AND shipment.merchant_id = order_row.merchant_id
      AND shipment.provider = 'GIGL'
      AND NULLIF(btrim(shipment.tracking_number), '') IS NOT NULL
      AND pg_catalog.char_length(btrim(shipment.tracking_number)) <= 128
  LOOP
    PERFORM private.reconcile_gigl_monitor_tenant(v_order_id);
  END LOOP;
END;
$$;
