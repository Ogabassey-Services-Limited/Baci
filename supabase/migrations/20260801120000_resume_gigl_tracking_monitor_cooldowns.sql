-- Let unchanged GIGL monitors wake up for a bounded retry after their cooldown.

CREATE INDEX shipment_tracking_monitors_paused_due_idx
  ON public.shipment_tracking_monitors (next_poll_at)
  WHERE state = 'paused' AND next_poll_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_due_gigl_tracking_monitors(
  p_limit integer,
  p_worker_id text
)
RETURNS TABLE (
  shipment_id uuid,
  tracking_epoch_id uuid,
  order_id uuid,
  tracking_number text,
  state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'GIGL monitor claims require service role'
      USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'GIGL monitor claim limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_worker_id), '') IS NULL
    OR char_length(btrim(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'GIGL monitor worker id is invalid' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH due_monitors AS (
    SELECT monitor.shipment_id
    FROM public.shipment_tracking_monitors AS monitor
    WHERE monitor.state IN ('active', 'final_poll', 'paused')
      AND monitor.next_poll_at <= now()
      AND (
        monitor.locked_at IS NULL
        OR monitor.locked_at < now() - interval '15 minutes'
      )
    ORDER BY monitor.next_poll_at ASC, monitor.shipment_id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed_monitors AS (
    UPDATE public.shipment_tracking_monitors AS monitor
    SET locked_at = now(), locked_by = btrim(p_worker_id), updated_at = now()
    FROM due_monitors
    WHERE monitor.shipment_id = due_monitors.shipment_id
    RETURNING monitor.shipment_id, monitor.tracking_epoch_id, monitor.order_id,
      monitor.tracking_number, monitor.state
  )
  SELECT * FROM claimed_monitors;
END;
$$;

ALTER FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  TO service_role;
