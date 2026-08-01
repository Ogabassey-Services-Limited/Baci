-- Worker-only leases serialize provider polling across overlapping cron runs.

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
    WHERE monitor.state IN ('active', 'final_poll')
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

CREATE OR REPLACE FUNCTION public.release_gigl_tracking_claim(
  p_shipment_id uuid,
  p_tracking_epoch_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_released boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'GIGL monitor claim release requires service role'
      USING ERRCODE = '42501';
  END IF;
  IF p_shipment_id IS NULL OR p_tracking_epoch_id IS NULL
    OR nullif(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'GIGL monitor claim release arguments are invalid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.shipment_tracking_monitors AS monitor
  SET locked_at = NULL, locked_by = NULL, updated_at = now()
  WHERE monitor.shipment_id = p_shipment_id
    AND monitor.tracking_epoch_id = p_tracking_epoch_id
    AND monitor.locked_by = btrim(p_worker_id)
  RETURNING true INTO v_released;

  RETURN coalesce(v_released, false);
END;
$$;

ALTER FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  OWNER TO postgres;
ALTER FUNCTION public.release_gigl_tracking_claim(uuid, uuid, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_gigl_tracking_claim(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_gigl_tracking_monitors(integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_gigl_tracking_claim(uuid, uuid, text)
  TO service_role;
