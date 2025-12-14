-- Bulk Indexing Script for Foreign Keys
-- Timestamp: 2025-12-14

DO $$
DECLARE
    r record;
    sql_statement text;
BEGIN
    FOR r IN
        SELECT
            c.conrelid,
            c.conname AS constraint_name,
            c.conkey,
            c.conrelid::regclass AS table_name
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f'
        AND n.nspname = 'public'
        AND NOT EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indrelid = c.conrelid
            AND i.indkey[0] = c.conkey[0]
        )
    LOOP
        sql_statement := format(
            'CREATE INDEX IF NOT EXISTS "idx_%s_%s" ON %s USING btree (%I)',
            replace(r.table_name::text, 'public.', ''),
            r.constraint_name,
            r.table_name,
            (SELECT attname FROM pg_attribute WHERE attrelid = r.conrelid AND attnum = r.conkey[1])
        );
        RAISE NOTICE 'Creating index: %', sql_statement;
        EXECUTE sql_statement;
    END LOOP;
END$$;
