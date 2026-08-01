-- A notification may be retried until an Expo request begins, but never after
-- that boundary because the provider can accept a request whose response is lost.

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

CREATE OR REPLACE FUNCTION public.claim_shipment_tracking_notifications(
  p_limit integer, p_worker_id text
)
RETURNS TABLE (
  id uuid, shipment_id uuid, tracking_epoch_id uuid, order_id uuid,
  merchant_id uuid, tracking_event_id uuid, audience text, notification_kind text,
  attempt_count integer, max_attempts integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'tracking notification claims require service role' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR nullif(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'tracking notification claim arguments are invalid' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH expired_delivery AS (
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'failed', locked_at = NULL, locked_by = NULL,
      next_attempt_at = now(),
      last_error = coalesce(outbox.last_error, 'delivery_outcome_unknown'),
      updated_at = now()
    WHERE outbox.status = 'processing'
      AND outbox.delivery_started_at IS NOT NULL
      AND outbox.locked_at < now() - interval '15 minutes'
    RETURNING outbox.id
  ), candidates AS (
    SELECT outbox.id
    FROM public.shipment_tracking_notification_outbox AS outbox
    WHERE outbox.attempt_count < outbox.max_attempts
      AND (
        (outbox.status = 'pending' AND outbox.next_attempt_at <= now())
        OR (
          outbox.status = 'processing'
          AND outbox.delivery_started_at IS NULL
          AND outbox.locked_at < now() - interval '15 minutes'
        )
      )
    ORDER BY outbox.next_attempt_at ASC, outbox.created_at ASC
    LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'processing', locked_at = now(), locked_by = btrim(p_worker_id),
      updated_at = now()
    FROM candidates WHERE outbox.id = candidates.id
    RETURNING outbox.id, outbox.shipment_id, outbox.tracking_epoch_id,
      outbox.order_id, outbox.merchant_id, outbox.tracking_event_id,
      outbox.audience, outbox.notification_kind, outbox.attempt_count, outbox.max_attempts
  ) SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_shipment_tracking_notification_dispatch(
  p_id uuid, p_worker_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_started boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'tracking notification dispatch requires service role' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET delivery_started_at = now(), attempt_count = outbox.attempt_count + 1,
    updated_at = now()
  WHERE outbox.id = p_id AND outbox.status = 'processing'
    AND outbox.locked_by = btrim(p_worker_id)
    AND outbox.delivery_started_at IS NULL
    AND outbox.attempt_count < outbox.max_attempts
  RETURNING true INTO v_started;
  RETURN coalesce(v_started, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_shipment_tracking_notification(
  p_id uuid, p_worker_id text, p_outcome text, p_error text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_completed boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'tracking notification completion requires service role' USING ERRCODE = '42501';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'tracking notification outcome is invalid' USING ERRCODE = '22023';
  END IF;
  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET status = CASE
      WHEN p_outcome = 'failed'
        AND outbox.delivery_started_at IS NULL
        AND outbox.attempt_count < outbox.max_attempts
        THEN 'pending'
      ELSE p_outcome
    END,
    sent_at = CASE WHEN p_outcome = 'sent' THEN now() ELSE NULL END,
    skipped_at = CASE WHEN p_outcome = 'skipped' THEN now() ELSE NULL END,
    next_attempt_at = CASE
      WHEN p_outcome = 'failed'
        AND outbox.delivery_started_at IS NULL
        AND outbox.attempt_count < outbox.max_attempts
        THEN now() + interval '5 minutes'
      ELSE now()
    END,
    locked_at = NULL, locked_by = NULL,
    last_error = left(nullif(btrim(p_error), ''), 512), updated_at = now()
  WHERE outbox.id = p_id AND outbox.status = 'processing'
    AND outbox.locked_by = btrim(p_worker_id)
  RETURNING true INTO v_completed;
  RETURN coalesce(v_completed, false);
END;
$$;

ALTER FUNCTION public.claim_shipment_tracking_notifications(integer, text) OWNER TO postgres;
ALTER FUNCTION public.begin_shipment_tracking_notification_dispatch(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_shipment_tracking_notifications(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_shipment_tracking_notification_dispatch(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shipment_tracking_notifications(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_shipment_tracking_notification_dispatch(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text) TO service_role;
