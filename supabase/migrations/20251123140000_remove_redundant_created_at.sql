-- =============================================
-- MIGRATION: Remove Redundant created_at Column from audit_logs
-- Date: 2025-11-23
-- Purpose: Remove redundant created_at column since timestamp serves this purpose
-- =============================================

ALTER TABLE audit_logs DROP COLUMN IF EXISTS created_at;

-- Comment for documentation
COMMENT ON TABLE audit_logs IS 'Tracks sensitive operations for auditing and forensics. Uses timestamp column for creation time.';
