-- =============================================
-- RATE LIMIT LOG TABLE
-- =============================================
-- This table stores rate limit tracking data for API endpoints
-- Used by the check_rate_limit() function

CREATE TABLE IF NOT EXISTS rate_limit_log (
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  -- Field included for audit trail and debugging purposes; not referenced by check_rate_limit().
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (identifier, endpoint, window_start)
);

-- Trigger to automatically update 'updated_at' on row modification
CREATE OR REPLACE FUNCTION trg_set_updated_at_rate_limit_log()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_rate_limit_log
BEFORE UPDATE ON rate_limit_log
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at_rate_limit_log();

-- Index for faster cleanup queries
CREATE INDEX idx_rate_limit_log_window_start ON rate_limit_log(window_start);

-- Enable RLS (rate limiting is managed by the function, not user-specific)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Create a strict policy to only allow access via the backend role (such as service_role), and block direct access from client roles.
-- This ensures rate limiting data can only be accessed through the check_rate_limit() function,
-- which is executed with the permissions of the caller but the table is only accessible to service_role.
-- You may need to adjust this to reflect your actual backend/API user.
CREATE POLICY rate_limit_service_access ON rate_limit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions only to service_role (backend API access)
-- Remove broad grants to authenticated and anon roles for security
-- Rate limiting functions will execute with service_role privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_log TO service_role;
