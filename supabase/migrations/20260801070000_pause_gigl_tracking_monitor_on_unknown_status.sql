-- Stop retrying a monitor when GIGL returns events without a known lifecycle code.

CREATE OR REPLACE FUNCTION public.pause_gigl_tracking_monitor(
  p_shipment_id uuid,
  p_tracking_epoch_id uuid,
  p_worker_id text,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paused boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'GIGL monitor pause requires service role'
      USING ERRCODE = '42501';
  END IF;
  IF p_shipment_id IS NULL OR p_tracking_epoch_id IS NULL
    OR nullif(btrim(p_worker_id), '') IS NULL
    OR nullif(btrim(p_error), '') IS NULL THEN
    RAISE EXCEPTION 'GIGL monitor pause arguments are invalid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.shipment_tracking_monitors AS monitor
  SET state = 'paused',
    next_poll_at = NULL,
    stopped_at = now(),
    last_error = left(nullif(btrim(p_error), ''), 512),
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE monitor.shipment_id = p_shipment_id
    AND monitor.tracking_epoch_id = p_tracking_epoch_id
    AND monitor.locked_by = btrim(p_worker_id)
  RETURNING true INTO v_paused;

  RETURN coalesce(v_paused, false);
END;
$$;

ALTER FUNCTION public.pause_gigl_tracking_monitor(uuid, uuid, text, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pause_gigl_tracking_monitor(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_gigl_tracking_monitor(uuid, uuid, text, text)
  TO service_role;
