-- Keep definitive provider rejections retryable after a delivery attempt.

CREATE OR REPLACE FUNCTION public.complete_shipment_tracking_notification(
  p_id uuid, p_worker_id text, p_outcome text, p_error text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_completed boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'tracking notification completion requires service role' USING ERRCODE = '42501';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent', 'skipped', 'failed', 'rejected') THEN
    RAISE EXCEPTION 'tracking notification outcome is invalid' USING ERRCODE = '22023';
  END IF;
  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET attempt_count = outbox.attempt_count + CASE
      WHEN p_outcome = 'failed' AND outbox.delivery_started_at IS NULL THEN 1 ELSE 0 END,
    status = CASE
      WHEN p_outcome = 'rejected' AND outbox.attempt_count < outbox.max_attempts
        THEN 'pending'
      WHEN p_outcome = 'failed'
        AND outbox.delivery_started_at IS NULL
        AND outbox.attempt_count + 1 < outbox.max_attempts
        THEN 'pending'
      WHEN p_outcome = 'rejected' THEN 'failed'
      ELSE p_outcome
    END,
    sent_at = CASE WHEN p_outcome = 'sent' THEN now() ELSE NULL END,
    skipped_at = CASE WHEN p_outcome = 'skipped' THEN now() ELSE NULL END,
    skip_reason = CASE WHEN p_outcome = 'skipped'
      THEN left(nullif(btrim(p_error), ''), 512) ELSE NULL END,
    next_attempt_at = CASE
      WHEN p_outcome = 'rejected'
        AND outbox.attempt_count < outbox.max_attempts
        THEN now() + interval '5 minutes'
      WHEN p_outcome = 'failed'
        AND outbox.delivery_started_at IS NULL
        AND outbox.attempt_count + 1 < outbox.max_attempts
        THEN now() + interval '5 minutes'
      ELSE now()
    END,
    delivery_started_at = CASE
      WHEN p_outcome = 'rejected'
        AND outbox.attempt_count < outbox.max_attempts
        THEN NULL
      WHEN p_outcome = 'failed'
        AND outbox.delivery_started_at IS NULL
        AND outbox.attempt_count + 1 < outbox.max_attempts
        THEN NULL
      ELSE outbox.delivery_started_at
    END,
    locked_at = NULL,
    locked_by = NULL,
    last_error = CASE WHEN p_outcome IN ('failed', 'rejected')
      THEN left(nullif(btrim(p_error), ''), 512) ELSE NULL END,
    updated_at = now()
  WHERE outbox.id = p_id AND outbox.status = 'processing'
    AND outbox.locked_by = btrim(p_worker_id)
  RETURNING true INTO v_completed;
  RETURN coalesce(v_completed, false);
END;
$$;

ALTER FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shipment_tracking_notification(uuid, text, text, text)
  TO service_role;
