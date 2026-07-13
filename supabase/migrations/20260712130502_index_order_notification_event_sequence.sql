-- disable-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_notification_outbox_event_sequence
  ON public.order_notification_outbox (order_id, event_type, event_sequence DESC);
