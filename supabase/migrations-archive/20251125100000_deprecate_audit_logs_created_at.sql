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
DECLARE
    -- No variables needed, but DECLARE section is required for proper error handling
BEGIN
    -- Set a restrictive search_path to minimize risk of accidental schema manipulation
    PERFORM set_config('search_path', 'public', true);
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'timestamp'
    ) THEN
        RAISE EXCEPTION 'Cannot drop created_at: The required replacement column "timestamp" does not exist in the "audit_logs" table. Please ensure the "timestamp" column exists before running this migration (see migration 20251123130000_create_audit_logs.sql or consult schema documentation).';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error in migration anonymous block: %', SQLERRM;
        RAISE;
END;
$$;

-- Migrate existing data: copy non-null created_at values to timestamp where timestamp is NULL
-- This preserves any existing data before dropping the column
UPDATE audit_logs 
SET "timestamp" = created_at 
WHERE "timestamp" IS NULL AND created_at IS NOT NULL;

-- Drop the redundant column now that we have verified the timestamp column exists
-- and migrated any existing data
ALTER TABLE audit_logs DROP COLUMN IF EXISTS created_at;

-- Update the table comment to reflect the schema change in the same transaction
COMMENT ON TABLE audit_logs IS 'Tracks sensitive operations for auditing and forensics. The "timestamp" column records the creation time as TIMESTAMPTZ (timestamp with time zone, stored in UTC). It is NOT NULL with a DEFAULT of NOW() and is indexed (idx_audit_logs_timestamp) for fast chronological querying, ensuring data integrity and reliable audit trail tracking.';

COMMIT;
