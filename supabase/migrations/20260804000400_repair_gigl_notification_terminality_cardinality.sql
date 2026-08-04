-- Append-only successor for the unpublished GIGL notification-recovery repair.
--
-- The original 20260804000200 repair remains immutable. It expected one
-- terminality replacement even though the pre-repair function has three
-- monitor-field predicates. The deployment applier runs this successor at the
-- historical 20260801142000 source position and explicitly skips 040002 only
-- after recording this correction with that historical source.

DROP FUNCTION IF EXISTS public.reset_shipment_tracking_notification_dispatch(
  uuid, text
);

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
  v_expected_scope text;
BEGIN
  SELECT pg_get_functiondef(
    'private.activate_gigl_tracking_monitor()'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN',
    E'     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id\n'
      || E'     AND NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN'
  );
  v_expected_scope :=
    E'     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id\n'
    || E'     AND NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN';
  IF v_definition = v_original_definition
    OR pg_catalog.strpos(v_definition, v_expected_scope) = 0
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_scope, '')
      )
    ) <> pg_catalog.length(v_expected_scope) THEN
    RAISE EXCEPTION 'GIGL monitor identity must include merchant ownership';
  END IF;
  EXECUTE v_definition;
END;
$migration$;

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
  v_expected_declaration text;
  v_expected_assignment text;
  v_expected_monitor_terminality text;
  v_expected_next_poll_terminality text;
  v_expected_stopped_terminality text;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'  v_should_update_delivery boolean := false;\n',
    E'  v_should_update_delivery boolean := false;\n'
      || E'  v_manual_terminal_failed boolean := false;\n'
  );
  v_definition := replace(
    v_definition,
    E'  v_should_update_location := v_current_location IS NOT NULL\n',
    E'  v_manual_terminal_failed := v_effective_status = ''failed''\n'
      || E'    AND v_manual_terminal_override_at IS NOT NULL\n'
      || E'    AND (\n'
      || E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at\n'
      || E'    );\n'
      || E'  v_should_update_location := v_current_location IS NOT NULL\n'
  );
  v_definition := replace(
    v_definition,
    E'v_monitor_state := CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'v_monitor_state := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_definition := replace(
    v_definition,
    E'v_next_poll_at := CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'v_next_poll_at := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_definition := replace(
    v_definition,
    E'v_stopped_at := CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'v_stopped_at := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_expected_declaration :=
    E'  v_manual_terminal_failed boolean := false;\n';
  v_expected_assignment :=
    E'  v_manual_terminal_failed := v_effective_status = ''failed''\n'
    || E'    AND v_manual_terminal_override_at IS NOT NULL\n'
    || E'    AND (\n'
    || E'      v_latest_incoming_event_at IS NULL\n'
    || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at\n'
    || E'    );\n';
  v_expected_monitor_terminality :=
    E'v_monitor_state := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  v_expected_next_poll_terminality :=
    E'v_next_poll_at := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  v_expected_stopped_terminality :=
    E'v_stopped_at := CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  IF v_definition = v_original_definition
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_declaration, '')
      )
    ) <> pg_catalog.length(v_expected_declaration)
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_assignment, '')
      )
    ) <> pg_catalog.length(v_expected_assignment)
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_monitor_terminality, '')
      )
    ) <> pg_catalog.length(v_expected_monitor_terminality)
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_next_poll_terminality, '')
      )
    ) <> pg_catalog.length(v_expected_next_poll_terminality)
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_stopped_terminality, '')
      )
    ) <> pg_catalog.length(v_expected_stopped_terminality) THEN
    RAISE EXCEPTION 'GIGL manual failed terminal state hardening did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
