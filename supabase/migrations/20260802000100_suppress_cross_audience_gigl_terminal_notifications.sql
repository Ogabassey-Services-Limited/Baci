-- A terminal GIGL event invalidates older pending milestones for every
-- audience, even when the notification policy only emits the newer event for
-- one audience.

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
  WHERE (
      stale.status = 'pending'
      OR (
        stale.status = 'processing'
        AND stale.delivery_started_at IS NULL
      )
    )
    AND stale_event.id = stale.tracking_event_id
    AND stale_event.provider = 'GIGL'
    AND newer.id <> stale.id
    AND newer.shipment_id = stale.shipment_id
    AND newer.tracking_epoch_id = stale.tracking_epoch_id
    AND (
      newer.audience = stale.audience
      OR newer_event.normalized_status IN ('delivered', 'cancelled', 'returned')
    )
    AND (
      newer.status IN ('pending', 'processing', 'sent', 'failed')
      OR (
        newer_event.normalized_status IN ('delivered', 'cancelled', 'returned')
        AND newer.status = 'skipped'
      )
    )
    AND newer_event.id = newer.tracking_event_id
    AND newer_event.provider = 'GIGL'
    AND newer_event.occurred_at > stale_event.occurred_at;

  DELETE FROM public.shipment_tracking_notification_outbox AS stale
  USING inserted_outbox AS inserted_stale,
    public.shipment_tracking_notification_outbox AS newer,
    public.shipment_tracking_events AS stale_event,
    public.shipment_tracking_events AS newer_event
  WHERE stale.id = inserted_stale.id
    AND (
      stale.status = 'pending'
      OR (
        stale.status = 'processing'
        AND stale.delivery_started_at IS NULL
      )
    )
    AND stale_event.id = stale.tracking_event_id
    AND stale_event.provider = 'GIGL'
    AND newer.id <> stale.id
    AND newer.shipment_id = stale.shipment_id
    AND newer.tracking_epoch_id = stale.tracking_epoch_id
    AND (
      newer.audience = stale.audience
      OR newer_event.normalized_status IN ('delivered', 'cancelled', 'returned')
    )
    AND (
      newer.status IN ('pending', 'processing', 'sent', 'failed')
      OR (
        newer_event.normalized_status IN ('delivered', 'cancelled', 'returned')
        AND newer.status = 'skipped'
      )
    )
    AND newer_event.id = newer.tracking_event_id
    AND newer_event.provider = 'GIGL'
    AND newer_event.occurred_at > stale_event.occurred_at;

  RETURN NULL;
END;
$$;

ALTER FUNCTION private.suppress_late_gigl_tracking_notifications()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.suppress_late_gigl_tracking_notifications()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS suppress_late_gigl_tracking_notifications
  ON public.shipment_tracking_notification_outbox;
CREATE TRIGGER suppress_late_gigl_tracking_notifications
  AFTER INSERT ON public.shipment_tracking_notification_outbox
  REFERENCING NEW TABLE AS inserted_outbox
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.suppress_late_gigl_tracking_notifications();
