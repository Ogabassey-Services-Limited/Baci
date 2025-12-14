-- Smart Deduplication Script
DO $$
DECLARE
    r record;
    i integer;
BEGIN
    FOR r IN
        SELECT
            array_agg(indexrelid::regclass::text ORDER BY length(indexrelid::regclass::text) DESC) as indexes
        FROM pg_index
        WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
        GROUP BY indrelid, indkey
        HAVING count(*) > 1
    LOOP
        -- Drop all except the last one (shortest name)
        FOR i IN 1 .. array_length(r.indexes, 1) - 1
        LOOP
            RAISE NOTICE 'Dropping redundant index: %', r.indexes[i];
            EXECUTE 'DROP INDEX IF EXISTS ' || r.indexes[i];
        END LOOP;
    END LOOP;
END$$;
