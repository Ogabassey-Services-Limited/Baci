-- Append-only repair for the failed GIGL manual-failure status-scope migration.
--
-- 20260801142100_preserve_manual_gigl_failures_after_unknown_scans.sql remains
-- immutable. Its adjacent PostgreSQL escape-string literals were rejected
-- before it could be recorded. The deployment applier runs this correction at
-- the historical source position after verifying the exact source checksum.

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
    E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at',
    E'      v_latest_status_event_at IS NULL\n'
      || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at'
  );
  v_expected_scope :=
    E'      v_latest_status_event_at IS NULL\n'
    || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at';
  IF v_definition = v_original_definition
    OR pg_catalog.strpos(v_definition, v_expected_scope) = 0
    OR pg_catalog.strpos(
      v_definition,
      E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at'
    ) <> 0 THEN
    RAISE EXCEPTION 'GIGL manual failure terminality must use status events';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
