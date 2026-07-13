-- Validate the backfilled event ordering key without holding a table-wide
-- validation lock for the duration of the initial constraint creation.
ALTER TABLE public.order_notification_outbox
  ADD CONSTRAINT order_notification_outbox_event_sequence_not_null
  CHECK (event_sequence IS NOT NULL) NOT VALID;

ALTER TABLE public.order_notification_outbox
  VALIDATE CONSTRAINT order_notification_outbox_event_sequence_not_null;

ALTER TABLE public.order_notification_outbox
  ALTER COLUMN event_sequence SET NOT NULL;

ALTER TABLE public.order_notification_outbox
  DROP CONSTRAINT order_notification_outbox_event_sequence_not_null;
