-- Compare retry recovery with the event that produced the persisted failure,
-- not a later scan with an unrecognized or non-lifecycle status.

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
    E'      AND (\n'
      E'        v_latest_persisted_event_at IS NULL\n'
      E'        OR v_latest_status_event_at >= v_latest_persisted_event_at\n'
      E'      )\n'
      E'      THEN p_status',
    E'      AND (\n'
      E'        v_latest_persisted_status_event_at IS NULL\n'
      E'        OR v_latest_status_event_at >= v_latest_persisted_status_event_at\n'
      E'      )\n'
      E'      THEN p_status'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%v_latest_persisted_status_event_at%' THEN
    RAISE EXCEPTION 'GIGL recovery status-event scope did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
