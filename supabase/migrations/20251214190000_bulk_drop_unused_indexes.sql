-- Bulk Drop Unused Indexes Script
-- CAUTION: Drops all public indexes with 0 scans (excluding PK/Unique)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT pg_index.indexrelid::regclass::text as index_name
        FROM pg_stat_user_indexes
        JOIN pg_index ON pg_index.indexrelid = pg_stat_user_indexes.indexrelid
        WHERE pg_stat_user_indexes.schemaname = 'public'
        AND pg_stat_user_indexes.idx_scan = 0
        AND NOT pg_index.indisunique
        AND NOT pg_index.indisprimary
    LOOP
        RAISE NOTICE 'Dropping unused index: %', r.index_name;
        EXECUTE 'DROP INDEX IF EXISTS ' || r.index_name;
    END LOOP;
END$$;
