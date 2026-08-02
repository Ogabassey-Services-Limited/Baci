-- Manual failed overrides must be evaluated against recognized status events.
-- An unknown newer scan should not reopen a shipment that a merchant failed.

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'      v_latest_incoming_event_at IS NULL\n'
      E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at',
    E'      v_latest_status_event_at IS NULL\n'
      E'      OR v_latest_status_event_at <= v_manual_terminal_override_at'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%v_latest_status_event_at <= v_manual_terminal_override_at%'
    OR v_definition LIKE '%v_latest_incoming_event_at <= v_manual_terminal_override_at%' THEN
    RAISE EXCEPTION 'GIGL manual failure terminality must use status events';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
