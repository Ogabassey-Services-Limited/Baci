ALTER TABLE public.jumia_orders
  ADD COLUMN IF NOT EXISTS notification_claimed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_jumia_orders_notification_claim_lease
  ON public.jumia_orders (merchant_id, notification_claimed_at)
  WHERE notification_sent IS NOT TRUE;

COMMENT ON COLUMN public.jumia_orders.notification_claimed_at IS
  'Short-lived claim lease used to prevent concurrent duplicate Jumia order push notifications without marking undelivered pushes as sent.';
