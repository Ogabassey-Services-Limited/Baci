-- Append-only repair for the failed GIGL failed-event recovery-scope migration.
--
-- 20260801141900_scope_gigl_recovery_to_failed_event.sql remains immutable.
-- Its adjacent PostgreSQL escape-string literals were rejected before the
-- migration could be recorded. The deployment applier runs this correction at
-- the original source position after verifying the historical source checksum.

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
  v_expected_scope text;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'      AND (\n'
      || E'        v_latest_persisted_event_at IS NULL\n'
      || E'        OR v_latest_status_event_at >= v_latest_persisted_event_at\n'
      || E'      )\n'
      || E'      THEN p_status',
    E'      AND (\n'
      || E'        v_latest_persisted_status_event_at IS NULL\n'
      || E'        OR v_latest_status_event_at >= v_latest_persisted_status_event_at\n'
      || E'      )\n'
      || E'      THEN p_status'
  );
  v_expected_scope :=
    E'      AND (\n'
    || E'        v_latest_persisted_status_event_at IS NULL\n'
    || E'        OR v_latest_status_event_at >= v_latest_persisted_status_event_at\n'
    || E'      )\n'
    || E'      THEN p_status';
  IF v_definition = v_original_definition
    OR pg_catalog.strpos(v_definition, v_expected_scope) = 0
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_scope, '')
      )
    ) <> pg_catalog.length(v_expected_scope) THEN
    RAISE EXCEPTION 'GIGL failed-event recovery scope did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
