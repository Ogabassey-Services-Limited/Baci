-- Dynamic Bulk Index Execution
-- Timestamp: 2025-12-14 (Final Fix)

DO $$
DECLARE
    sql_to_run text;
BEGIN
    SELECT string_agg(
        format('CREATE INDEX IF NOT EXISTS "idx_%s_%s" ON %s (%I);', 
            replace(c.conrelid::regclass::text, 'public.', ''), c.conname, c.conrelid::regclass, a.attname),
        E'\n'
    ) INTO sql_to_run
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' 
    AND c.connamespace = 'public'::regnamespace
    AND NOT EXISTS (
        SELECT 1 FROM pg_index i 
        WHERE i.indrelid = c.conrelid 
        AND (i.indkey::int2[])[1] = c.conkey[1]
    );

    IF sql_to_run IS NOT NULL THEN
        RAISE NOTICE 'Executing bulk index creation...';
        EXECUTE sql_to_run;
    ELSE
        RAISE NOTICE 'No unindexed foreign keys found.';
    END IF;
END$$;
