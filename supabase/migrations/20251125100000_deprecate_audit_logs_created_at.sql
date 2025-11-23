-- =============================================
-- MIGRATION: Deprecate created_at from audit_logs
-- Date: 2025-11-25
-- Purpose: Remove redundant created_at column since timestamp serves this purpose,
--          with added safety checks and transactional integrity.
-- =============================================

BEGIN;

-- Verify that the 'timestamp' column exists before dropping 'created_at'.
-- This acts as a safety check to ensure our assumptions about the schema are correct.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'timestamp'
    ) THEN
        RAISE EXCEPTION 'Cannot drop created_at: The required replacement column "timestamp" does not exist in the "audit_logs" table.';
    END IF;
END;
$$;

-- Drop the redundant column now that we have verified the timestamp column exists.
ALTER TABLE audit_logs DROP COLUMN IF EXISTS created_at;

-- Update the table comment to reflect the schema change in the same transaction.
COMMENT ON TABLE audit_logs IS 'Tracks sensitive operations for auditing and forensics. The "timestamp" column serves as the creation time.';

COMMIT;
