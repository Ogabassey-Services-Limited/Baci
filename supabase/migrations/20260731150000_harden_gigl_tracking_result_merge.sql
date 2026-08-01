-- Preserve tracking history written by older camelCase clients and reject empty
-- observations before they can overwrite an existing shipment lifecycle state.

CREATE OR REPLACE FUNCTION public.apply_gigl_tracking_result(
  p_shipment_id uuid,
  p_tracking_epoch_id uuid,
  p_worker_id text,
  p_status text,
  p_current_location text,
  p_actual_delivery timestamptz,
  p_events jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_inserted_events integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'GIGL tracking result application requires service role'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN (
    'pending', 'booked', 'pickup_scheduled', 'picked_up', 'in_transit',
    'out_for_delivery', 'delivered', 'cancelled', 'failed', 'returned'
  ) OR jsonb_typeof(p_events) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_events) = 0 THEN
    RAISE EXCEPTION 'GIGL tracking result is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT monitor.order_id INTO v_order_id
  FROM public.shipment_tracking_monitors AS monitor
  WHERE monitor.shipment_id = p_shipment_id
    AND monitor.tracking_epoch_id = p_tracking_epoch_id
    AND monitor.locked_by = btrim(p_worker_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_events) AS event(
      provider_event_key text, raw_status text, normalized_status text,
      description text, occurred_at timestamptz
    )
    WHERE nullif(btrim(event.provider_event_key), '') IS NULL
      OR nullif(btrim(event.raw_status), '') IS NULL
      OR nullif(btrim(event.description), '') IS NULL
      OR event.normalized_status NOT IN (
        'pending', 'booked', 'pickup_scheduled', 'picked_up', 'in_transit',
        'out_for_delivery', 'delivered', 'cancelled', 'failed', 'returned'
      )
      OR event.occurred_at IS NULL
  ) THEN
    RAISE EXCEPTION 'GIGL tracking events are invalid' USING ERRCODE = '22023';
  END IF;

  WITH inserted_events AS (
    INSERT INTO public.shipment_tracking_events (
      shipment_id, tracking_epoch_id, tracking_number, provider,
      provider_event_key, provider_event_id, raw_status, normalized_status,
      description, location, occurred_at
    )
    SELECT
      p_shipment_id, p_tracking_epoch_id, monitor.tracking_number, 'GIGL',
      event.provider_event_key, nullif(event.provider_event_id, ''),
      event.raw_status, event.normalized_status, event.description,
      nullif(event.location, ''), event.occurred_at
    FROM public.shipment_tracking_monitors AS monitor
    CROSS JOIN LATERAL jsonb_to_recordset(p_events) AS event(
      provider_event_key text, provider_event_id text, raw_status text,
      normalized_status text, description text, location text, occurred_at timestamptz
    )
    WHERE monitor.shipment_id = p_shipment_id
      AND monitor.tracking_epoch_id = p_tracking_epoch_id
      AND monitor.locked_by = btrim(p_worker_id)
    ON CONFLICT (shipment_id, tracking_epoch_id, provider_event_key) DO NOTHING
    RETURNING id, raw_status, normalized_status, occurred_at
  ), queued_notifications AS (
    INSERT INTO public.shipment_tracking_notification_outbox (
      shipment_id, tracking_epoch_id, order_id, merchant_id, tracking_event_id,
      audience, notification_kind
    )
    SELECT event.shipment_id, event.tracking_epoch_id, shipment.order_id,
      shipment.merchant_id, event.id, policy.audience, policy.notification_kind
    FROM inserted_events AS event
    JOIN public.shipments AS shipment ON shipment.id = p_shipment_id
    JOIN public.shipment_tracking_monitors AS monitor ON monitor.shipment_id = p_shipment_id
      AND monitor.tracking_epoch_id = p_tracking_epoch_id
    JOIN private.gigl_tracking_notification_policy AS policy ON (
      policy.raw_status = upper(event.raw_status)
      OR (
        policy.raw_status IS NULL
        AND policy.normalized_status = event.normalized_status
        AND NOT EXISTS (
          SELECT 1 FROM private.gigl_tracking_notification_policy AS raw_policy
          WHERE raw_policy.raw_status = upper(event.raw_status)
        )
      )
    )
    WHERE event.occurred_at >= monitor.notification_events_not_before
    ON CONFLICT (shipment_id, tracking_epoch_id, audience, notification_kind)
      DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_events FROM inserted_events;

  UPDATE public.shipments AS shipment
  SET status = p_status,
    current_location = nullif(btrim(p_current_location), ''),
    delivered_at = coalesce(p_actual_delivery, shipment.delivered_at),
    tracking_events = (
      SELECT coalesce(
        jsonb_agg(merged.event ORDER BY merged.occurred_at),
        '[]'::jsonb
      )
      FROM (
        SELECT DISTINCT ON (identity.event_key)
          entry.event,
          coalesce(
            entry.event->>'occurred_at',
            entry.event->>'timestamp'
          ) AS occurred_at,
          identity.event_key
        FROM jsonb_array_elements(
          coalesce(shipment.tracking_events, '[]'::jsonb) || p_events
        ) AS entry(event)
        CROSS JOIN LATERAL (
          SELECT coalesce(
            nullif(btrim(entry.event->>'provider_event_key'), ''),
            nullif(btrim(entry.event->>'providerEventKey'), ''),
            nullif(btrim(entry.event->>'provider_event_id'), ''),
            nullif(btrim(entry.event->>'providerEventId'), ''),
            nullif(btrim(entry.event->>'occurred_at'), ''),
            nullif(btrim(entry.event->>'timestamp'), ''),
            entry.event::text
          ) AS event_key
        ) AS identity
        ORDER BY identity.event_key, coalesce(
          entry.event->>'occurred_at',
          entry.event->>'timestamp'
        )
      ) AS merged
    ),
    last_tracked_at = now(),
    updated_at = now()
  WHERE shipment.id = p_shipment_id
    AND shipment.order_id = v_order_id;

  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = CASE WHEN p_status IN ('delivered', 'cancelled', 'failed', 'returned')
      THEN 'terminal' ELSE 'active' END,
    next_poll_at = CASE WHEN p_status IN ('delivered', 'cancelled', 'failed', 'returned')
      THEN NULL ELSE now() + interval '15 minutes' END,
    stopped_at = CASE WHEN p_status IN ('delivered', 'cancelled', 'failed', 'returned')
      THEN now() ELSE NULL END,
    last_polled_at = now(),
    last_event_at = CASE WHEN v_inserted_events > 0 THEN now() ELSE monitor.last_event_at END,
    unchanged_poll_count = CASE WHEN v_inserted_events > 0 THEN 0 ELSE monitor.unchanged_poll_count + 1 END,
    consecutive_failures = 0, last_error = NULL, locked_at = NULL, locked_by = NULL,
    updated_at = now()
  WHERE monitor.shipment_id = p_shipment_id
    AND monitor.tracking_epoch_id = p_tracking_epoch_id
    AND monitor.locked_by = btrim(p_worker_id);

  RETURN true;
END;
$$;

ALTER FUNCTION public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)
  TO service_role;
