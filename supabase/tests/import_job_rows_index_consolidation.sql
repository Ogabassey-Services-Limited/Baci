-- Regression coverage for the import_job_rows duplicate-index consolidation.
-- Run: psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--   -f supabase/tests/import_job_rows_index_consolidation.sql

BEGIN;

DO $contract$
DECLARE
  v_columns text[];
BEGIN
  IF pg_catalog.to_regclass(
    'public.idx_import_job_rows_job_row_number'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'redundant import-job row index still exists';
  END IF;

  SELECT pg_catalog.array_agg(attribute.attname ORDER BY key.ordinality)
  INTO v_columns
  FROM pg_catalog.pg_index AS definition
  CROSS JOIN LATERAL pg_catalog.unnest(definition.indkey)
    WITH ORDINALITY AS key(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS attribute
    ON attribute.attrelid = definition.indrelid
   AND attribute.attnum = key.attnum
  WHERE definition.indexrelid =
    'public.import_job_rows_import_job_id_row_number_key'::pg_catalog.regclass
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
    RAISE EXCEPTION 'covering unique index drifted: %', v_columns;
  END IF;
END;
$contract$;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  'ab0d0e12-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'import-index-owner@example.com', 'test',
  now(), now(), now(), '{}', '{}'
);

INSERT INTO public.merchants (
  id, user_id, email, business_name, slug, is_published
) VALUES (
  'ab0d0e12-0000-4000-8000-000000000101',
  'ab0d0e12-0000-4000-8000-000000000001',
  'import-index-owner@example.com', 'Import Index Fixture',
  'import-index-fixture', true
);

INSERT INTO public.import_jobs (
  id, merchant_id, created_by, source_platform, entity_type, status,
  original_filename, storage_path
) VALUES (
  'ab0d0e12-0000-4000-8000-000000000201',
  'ab0d0e12-0000-4000-8000-000000000101',
  'ab0d0e12-0000-4000-8000-000000000001',
  'bumpa', 'products', 'preview_ready', 'fixture.csv', 'fixture/fixture.csv'
);

INSERT INTO public.import_job_rows (
  import_job_id, merchant_id, row_number, row_status, source_payload
) VALUES
  ('ab0d0e12-0000-4000-8000-000000000201',
   'ab0d0e12-0000-4000-8000-000000000101', 1, 'create', '{}'),
  ('ab0d0e12-0000-4000-8000-000000000201',
   'ab0d0e12-0000-4000-8000-000000000101', 2, 'create', '{}');

INSERT INTO public.import_job_rows (
  import_job_id, merchant_id, row_number, row_status, source_payload
) VALUES (
  'ab0d0e12-0000-4000-8000-000000000201',
  'ab0d0e12-0000-4000-8000-000000000101', 2, 'update', '{}'
)
ON CONFLICT (import_job_id, row_number)
DO UPDATE SET row_status = EXCLUDED.row_status;

DO $behavior$
DECLARE
  v_count integer;
  v_plan json;
  v_status text;
BEGIN
  SELECT pg_catalog.count(*), pg_catalog.max(row_status)
  INTO v_count, v_status
  FROM public.import_job_rows
  WHERE import_job_id = 'ab0d0e12-0000-4000-8000-000000000201';
  IF v_count <> 2 OR v_status IS DISTINCT FROM 'update' THEN
    RAISE EXCEPTION 'upsert parity failed: count %, status %', v_count, v_status;
  END IF;

  PERFORM pg_catalog.set_config('enable_seqscan', 'off', true);
  EXECUTE $plan$
    EXPLAIN (FORMAT JSON, COSTS OFF)
    SELECT row_number
    FROM public.import_job_rows
    WHERE import_job_id = 'ab0d0e12-0000-4000-8000-000000000201'
    ORDER BY row_number
  $plan$ INTO v_plan;
  IF v_plan::text NOT LIKE
    '%import_job_rows_import_job_id_row_number_key%' THEN
    RAISE EXCEPTION 'covering unique index not used: %', v_plan;
  END IF;

  DELETE FROM public.import_jobs
  WHERE id = 'ab0d0e12-0000-4000-8000-000000000201';
  SELECT pg_catalog.count(*) INTO v_count
  FROM public.import_job_rows
  WHERE import_job_id = 'ab0d0e12-0000-4000-8000-000000000201';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'import-job cascade left % rows', v_count;
  END IF;
END;
$behavior$;

ROLLBACK;
