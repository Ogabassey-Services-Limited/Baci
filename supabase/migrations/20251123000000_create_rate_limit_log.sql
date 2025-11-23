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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (identifier, endpoint, window_start)
);

-- Index for faster cleanup queries
CREATE INDEX idx_rate_limit_log_window_start ON rate_limit_log(window_start);

-- Enable RLS (rate limiting is managed by the function, not user-specific)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Allow the check_rate_limit function to insert/update records
-- Note: This is accessed via function calls which have their own permissions
CREATE POLICY rate_limit_access ON rate_limit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_log TO authenticated, anon;
