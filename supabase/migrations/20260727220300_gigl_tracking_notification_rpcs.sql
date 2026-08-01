-- Delivery attempts have an explicit uncertain state so a crashed worker never
-- blindly replays a provider-accepted push notification.

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
  WITH candidates AS (
    SELECT outbox.id
    FROM public.shipment_tracking_notification_outbox AS outbox
    WHERE outbox.attempt_count < outbox.max_attempts
      AND (
        (outbox.status = 'pending' AND outbox.next_attempt_at <= now())
        OR (outbox.status = 'processing' AND outbox.locked_at < now() - interval '15 minutes')
      )
    ORDER BY outbox.next_attempt_at ASC, outbox.created_at ASC
    LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'processing', locked_at = now(), locked_by = btrim(p_worker_id),
      attempt_count = outbox.attempt_count + 1, updated_at = now()
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
  SET delivery_started_at = now(), updated_at = now()
  WHERE outbox.id = p_id AND outbox.status = 'processing'
    AND outbox.locked_by = btrim(p_worker_id) AND outbox.delivery_started_at IS NULL
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
  SET status = CASE WHEN p_outcome = 'failed' AND outbox.attempt_count < outbox.max_attempts
      THEN 'pending' ELSE p_outcome END,
    sent_at = CASE WHEN p_outcome = 'sent' THEN now() ELSE NULL END,
    skipped_at = CASE WHEN p_outcome = 'skipped' THEN now() ELSE NULL END,
    next_attempt_at = CASE WHEN p_outcome = 'failed' AND outbox.attempt_count < outbox.max_attempts
      THEN now() + interval '5 minutes' ELSE now() END,
    delivery_started_at = CASE WHEN p_outcome = 'failed' AND outbox.attempt_count < outbox.max_attempts
      THEN NULL ELSE outbox.delivery_started_at END,
    locked_at = NULL, locked_by = NULL, last_error = left(nullif(btrim(p_error), ''), 512),
    updated_at = now()
  WHERE outbox.id = p_id AND outbox.status = 'processing' AND outbox.locked_by = btrim(p_worker_id)
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
