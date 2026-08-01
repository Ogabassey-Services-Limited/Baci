-- Pause unchanged GIGL monitors after 24 hours and let the due-claim RPC
-- resume them for another provider observation after the cooldown.

CREATE OR REPLACE FUNCTION private.pause_gigl_tracking_monitor_after_unchanged_polls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 96 successful 15-minute polls is approximately 24 hours.
  IF NEW.state = 'active' AND NEW.unchanged_poll_count >= 96 THEN
    NEW.state := 'paused';
    NEW.next_poll_at := now() + interval '24 hours';
    NEW.stopped_at := now();
    NEW.last_error := 'GIGL tracking unchanged after 96 successful polls';
    NEW.unchanged_poll_count := 96;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.pause_gigl_tracking_monitor_after_unchanged_polls()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.pause_gigl_tracking_monitor_after_unchanged_polls()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS pause_gigl_tracking_after_unchanged_polls
  ON public.shipment_tracking_monitors;
CREATE TRIGGER pause_gigl_tracking_after_unchanged_polls
BEFORE UPDATE OF state, unchanged_poll_count, next_poll_at
ON public.shipment_tracking_monitors
FOR EACH ROW
EXECUTE FUNCTION private.pause_gigl_tracking_monitor_after_unchanged_polls();
