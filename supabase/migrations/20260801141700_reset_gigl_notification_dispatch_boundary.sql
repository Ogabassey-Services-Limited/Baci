-- Clear the dispatch boundary only after the provider has explicitly rejected
-- every message, so a definitive rejection can be retried safely.

CREATE OR REPLACE FUNCTION public.reset_shipment_tracking_notification_dispatch(
  p_id uuid, p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reset boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'tracking notification dispatch reset requires service role'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.shipment_tracking_notification_outbox AS outbox
  SET delivery_started_at = NULL, updated_at = now()
  WHERE outbox.id = p_id
    AND outbox.status = 'processing'
    AND outbox.locked_by = btrim(p_worker_id)
    AND outbox.delivery_started_at IS NOT NULL
  RETURNING true INTO v_reset;

  RETURN coalesce(v_reset, false);
END;
$$;

ALTER FUNCTION public.reset_shipment_tracking_notification_dispatch(uuid, text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reset_shipment_tracking_notification_dispatch(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_shipment_tracking_notification_dispatch(uuid, text)
  TO service_role;
