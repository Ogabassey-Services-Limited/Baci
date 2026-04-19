CREATE TABLE IF NOT EXISTS push_notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app_type TEXT NOT NULL DEFAULT 'admin' CHECK (app_type IN ('admin', 'storefront')),
  channel TEXT,
  notification_type TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  status TEXT NOT NULL CHECK (
    status IN ('sent', 'partial_failure', 'failed', 'skipped_no_tokens')
  ),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_attempts_created_at
  ON push_notification_attempts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_attempts_status_created_at
  ON push_notification_attempts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_attempts_merchant_created_at
  ON push_notification_attempts(merchant_id, created_at DESC)
  WHERE merchant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_attempts_user_created_at
  ON push_notification_attempts(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE push_notification_attempts ENABLE ROW LEVEL SECURITY;
-- Service-role only. Notification attempts are operational telemetry.

CREATE OR REPLACE FUNCTION cleanup_old_push_attempts()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM push_notification_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
