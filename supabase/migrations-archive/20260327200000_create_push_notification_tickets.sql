-- Push notification tickets for receipt polling
-- Stores ticket IDs returned by Expo SDK for later delivery verification

CREATE TABLE IF NOT EXISTS push_notification_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,
  push_token TEXT NOT NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app_type TEXT NOT NULL DEFAULT 'admin' CHECK (app_type IN ('admin', 'storefront')),
  channel TEXT,
  notification_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  error_type TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_tickets_pending
  ON push_notification_tickets(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_push_tickets_merchant_id
  ON push_notification_tickets(merchant_id);

CREATE INDEX IF NOT EXISTS idx_push_tickets_user_id
  ON push_notification_tickets(user_id);

ALTER TABLE push_notification_tickets ENABLE ROW LEVEL SECURITY;
-- Service-role only (cron job uses admin client). No user-facing RLS policies needed.

-- Retention cleanup: remove tickets older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_push_tickets()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM push_notification_tickets
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
