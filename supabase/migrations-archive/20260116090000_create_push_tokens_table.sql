-- Migration: Add app_type column to push_tokens for admin vs storefront differentiation
-- Note: The push_tokens table already exists in production

-- Add app_type column to differentiate admin vs storefront tokens
ALTER TABLE push_tokens 
ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'admin' 
CHECK (app_type IN ('admin', 'storefront'));

-- Create index for app_type filtering
CREATE INDEX IF NOT EXISTS idx_push_tokens_app_type 
  ON push_tokens(app_type, is_active);

-- Update helper function to filter by app_type
CREATE OR REPLACE FUNCTION get_merchant_push_tokens(p_merchant_id UUID)
RETURNS TABLE (token TEXT, platform TEXT, device_name TEXT) AS $$
  SELECT token, platform, device_name
  FROM push_tokens
  WHERE merchant_id = p_merchant_id
    AND is_active = TRUE
    AND app_type = 'admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to get push token count by app type
CREATE OR REPLACE FUNCTION get_push_token_stats()
RETURNS TABLE (
  app_type TEXT,
  platform TEXT,
  active_count BIGINT,
  total_count BIGINT
) AS $$
  SELECT 
    app_type,
    platform,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
    COUNT(*) as total_count
  FROM push_tokens
  GROUP BY app_type, platform
  ORDER BY app_type, platform;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to deactivate stale tokens (not used in 90 days)
CREATE OR REPLACE FUNCTION cleanup_stale_push_tokens()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE push_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE
    AND last_used_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Platform admins can read all tokens (for broadcast notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'push_tokens' 
    AND policyname = 'admins_read_all_tokens'
  ) THEN
    CREATE POLICY "admins_read_all_tokens" ON push_tokens
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM merchants WHERE user_id = auth.uid() AND is_platform_admin = TRUE)
      );
  END IF;
END $$;
