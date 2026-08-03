-- disable-transaction

-- Bound late-notification suppression to rows inserted by the current
-- statement and rebuild its ordering index without blocking outbox writes.

CREATE OR REPLACE FUNCTION private.suppress_late_gigl_tracking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.shipment_tracking_notification_outbox AS stale
  USING public.shipment_tracking_events AS stale_event,
    inserted_outbox AS newer,
    public.shipment_tracking_events AS newer_event
  WHERE stale.status = 'pending'
    AND stale_event.id = stale.tracking_event_id
    AND stale_event.provider = 'GIGL'
    AND newer.id <> stale.id
    AND newer.shipment_id = stale.shipment_id
    AND newer.tracking_epoch_id = stale.tracking_epoch_id
    AND newer.audience = stale.audience
    AND newer.status IN ('pending', 'processing', 'sent')
    AND newer_event.id = newer.tracking_event_id
    AND newer_event.provider = 'GIGL'
    AND newer_event.occurred_at > stale_event.occurred_at;

  RETURN NULL;
END;
$$;

ALTER FUNCTION private.suppress_late_gigl_tracking_notifications() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.suppress_late_gigl_tracking_notifications()
  FROM PUBLIC, anon, authenticated, service_role;

DROP INDEX CONCURRENTLY IF EXISTS
  public.shipment_tracking_notification_outbox_ordering_idx;
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  shipment_tracking_notification_outbox_ordering_idx
  ON public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, audience, status
  );

DROP TRIGGER IF EXISTS suppress_late_gigl_tracking_notifications
  ON public.shipment_tracking_notification_outbox;
CREATE TRIGGER suppress_late_gigl_tracking_notifications
  AFTER INSERT ON public.shipment_tracking_notification_outbox
  REFERENCING NEW TABLE AS inserted_outbox
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.suppress_late_gigl_tracking_notifications();
