-- Allow multiple delivery attempts in one tracking epoch and retain a marker
-- for manual terminal overrides so later carrier scans can be compared with it.

ALTER TABLE public.shipment_tracking_monitors
  ADD COLUMN IF NOT EXISTS manual_terminal_override_at timestamptz;

ALTER TABLE public.shipment_tracking_notification_outbox
  DROP CONSTRAINT IF EXISTS shipment_tracking_notifications_identity_key;

ALTER TABLE public.shipment_tracking_notification_outbox
  ADD CONSTRAINT shipment_tracking_notifications_identity_key
  UNIQUE (
    shipment_id,
    tracking_epoch_id,
    tracking_event_id,
    audience,
    notification_kind
  );
