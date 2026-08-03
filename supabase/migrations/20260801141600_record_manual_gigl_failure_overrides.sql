-- A retryable carrier failure is not a terminal manual state. Record a later
-- merchant cancellation or return as an override instead of leaving the
-- failed monitor active and its pending notifications eligible for delivery.

CREATE OR REPLACE FUNCTION private.record_manual_gigl_failure_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider = 'GIGL'
    AND NEW.order_id IS NOT NULL
    AND OLD.status = 'failed'
    AND NEW.status IN ('delivered', 'cancelled', 'returned')
    AND NEW.last_tracked_at IS NOT DISTINCT FROM OLD.last_tracked_at THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.order_id::text, 0)
    );

    UPDATE public.shipment_tracking_notification_outbox AS outbox
    SET status = 'skipped', skipped_at = now(),
        skip_reason = 'tracking_terminal_override',
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE outbox.shipment_id = NEW.id
      AND (
        outbox.status = 'pending'
        OR (outbox.status = 'processing' AND outbox.delivery_started_at IS NULL)
      );

    UPDATE public.shipment_tracking_monitors AS monitor
    SET state = 'final_poll', next_poll_at = now(), stopped_at = NULL,
        manual_terminal_override_at = COALESCE(
          monitor.manual_terminal_override_at, now()
        ),
        notification_events_not_before = now(), updated_at = now()
    WHERE monitor.shipment_id = NEW.id
      AND monitor.state IN ('active', 'paused', 'final_poll', 'terminal');
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.record_manual_gigl_failure_override() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.record_manual_gigl_failure_override()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS record_manual_gigl_failure_override ON public.shipments;
CREATE TRIGGER record_manual_gigl_failure_override
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.record_manual_gigl_failure_override();
