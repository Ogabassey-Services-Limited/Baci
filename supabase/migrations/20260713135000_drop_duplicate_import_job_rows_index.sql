-- The unique constraint index covers the same ordered key as the redundant
-- non-unique index. Production evidence before this migration:
--   redundant size 1,761,280 bytes, 1,575 scans;
--   covering unique index size 1,761,280 bytes, 6,166 searches.
-- Recreate/rollback SQL:
--   CREATE INDEX idx_import_job_rows_job_row_number
--     ON public.import_job_rows (import_job_id, row_number);

DO $preflight$
DECLARE
  v_covering_index regclass := pg_catalog.to_regclass(
    'public.import_job_rows_import_job_id_row_number_key'
  );
  v_redundant_index regclass := pg_catalog.to_regclass(
    'public.idx_import_job_rows_job_row_number'
  );
  v_columns text[];
BEGIN
  IF v_covering_index IS NULL THEN
    RAISE EXCEPTION 'covering import-job row unique index is missing';
  END IF;

  SELECT pg_catalog.array_agg(attribute.attname ORDER BY key.ordinality)
  INTO v_columns
  FROM pg_catalog.pg_index AS definition
  CROSS JOIN LATERAL pg_catalog.unnest(definition.indkey)
    WITH ORDINALITY AS key(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS attribute
    ON attribute.attrelid = definition.indrelid
   AND attribute.attnum = key.attnum
  WHERE definition.indexrelid = v_covering_index
    AND definition.indisunique
    AND definition.indisvalid
    AND definition.indisready
    AND definition.indpred IS NULL
    AND definition.indexprs IS NULL
    AND definition.indnkeyatts = 2
    AND definition.indnatts = 2
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_definition
      WHERE constraint_definition.conindid = definition.indexrelid
        AND constraint_definition.contype = 'u'
    );
  IF v_columns IS DISTINCT FROM ARRAY['import_job_id', 'row_number'] THEN
    RAISE EXCEPTION 'covering import-job row unique index drifted: %', v_columns;
  END IF;

  IF v_redundant_index IS NOT NULL THEN
    v_columns := NULL;
    SELECT pg_catalog.array_agg(attribute.attname ORDER BY key.ordinality)
    INTO v_columns
    FROM pg_catalog.pg_index AS definition
    CROSS JOIN LATERAL pg_catalog.unnest(definition.indkey)
      WITH ORDINALITY AS key(attnum, ordinality)
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = definition.indrelid
     AND attribute.attnum = key.attnum
    WHERE definition.indexrelid = v_redundant_index
      AND NOT definition.indisunique
      AND definition.indisvalid
      AND definition.indisready
      AND definition.indpred IS NULL
      AND definition.indexprs IS NULL
      AND definition.indnkeyatts = 2
      AND definition.indnatts = 2
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_definition
        WHERE constraint_definition.conindid = definition.indexrelid
      );
    IF v_columns IS DISTINCT FROM ARRAY['import_job_id', 'row_number'] THEN
      RAISE EXCEPTION 'candidate import-job row index drifted: %', v_columns;
    END IF;
  END IF;
END;
$preflight$;

SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS public.idx_import_job_rows_job_row_number;
