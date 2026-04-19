-- =============================================
-- MIGRATION: Create Audit Logs Table
-- Date: 2025-11-23
-- Purpose: Track all sensitive domain and DNS operations
-- =============================================

-- Drop existing table if exists (for idempotency)
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  merchant_id UUID REFERENCES merchants(id), -- Nullable if action is not merchant-specific
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'domain', 'dns', 'email_forwarding', 'id_protection'
  resource_id TEXT NOT NULL, -- domain name or ID
  changes JSONB, -- Store before/after state
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL, -- 'success', 'failure'
  error_message TEXT
);

-- Create indexes for common query patterns
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_merchant ON audit_logs(merchant_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert logs (and authenticated users via API)
-- We allow authenticated users to insert because the API route runs as the user
-- but we might want to restrict this if we use a security definer function.
-- For now, standard insert policy for authenticated users is fine, 
-- but we should ideally wrap this in a function.
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE audit_logs IS 'Tracks sensitive operations for auditing and forensics.';
