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
  v_manual_terminal_assignment text;
  v_monitor_assignment text;
  v_selected_manual_scope text;
  v_unselected_manual_scope text;
  v_expected_declaration text;
  v_expected_assignment text;
  v_expected_monitor_terminality text;
  v_expected_next_poll_terminality text;
  v_expected_stopped_terminality text;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)'::regprocedure
  ) INTO v_original_definition;
  IF pg_catalog.strpos(
    v_original_definition,
    E'      v_latest_status_event_at IS NULL\n'
      || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at'
  ) > 0 THEN
    v_manual_terminal_assignment :=
      E'  v_manual_terminal_failed := v_effective_status = ''failed''\n'
      || E'    AND v_manual_terminal_override_at IS NOT NULL\n'
      || E'    AND (\n'
      || E'      v_latest_status_event_at IS NULL\n'
      || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at\n'
      || E'    );\n';
    v_selected_manual_scope :=
      E'      v_latest_status_event_at IS NULL\n'
      || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at';
    v_unselected_manual_scope :=
      E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at';
  ELSIF pg_catalog.strpos(
    v_original_definition,
    E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at'
  ) > 0 THEN
    v_manual_terminal_assignment :=
      E'  v_manual_terminal_failed := v_effective_status = ''failed''\n'
      || E'    AND v_manual_terminal_override_at IS NOT NULL\n'
      || E'    AND (\n'
      || E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at\n'
      || E'    );\n';
    v_selected_manual_scope :=
      E'      v_latest_incoming_event_at IS NULL\n'
      || E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at';
    v_unselected_manual_scope :=
      E'      v_latest_status_event_at IS NULL\n'
      || E'      OR v_latest_status_event_at <= v_manual_terminal_override_at';
  ELSE
    RAISE EXCEPTION 'GIGL manual failure terminality scope is missing';
  END IF;
  v_definition := replace(
    v_original_definition,
    E'  v_should_update_delivery boolean := false;\n',
    E'  v_should_update_delivery boolean := false;\n'
      || E'  v_manual_terminal_failed boolean := false;\n'
  );
  v_monitor_assignment :=
    E'  UPDATE public.shipment_tracking_monitors AS monitor\n'
    || E'  SET state = CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')';
  v_definition := replace(
    v_definition,
    v_monitor_assignment,
    v_manual_terminal_assignment || v_monitor_assignment
  );
  v_definition := replace(
    v_definition,
    E'SET state = CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'SET state = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_definition := replace(
    v_definition,
    E'next_poll_at = CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'next_poll_at = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_definition := replace(
    v_definition,
    E'stopped_at = CASE WHEN v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'stopped_at = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      || E'      OR v_manual_terminal_failed)'
  );
  v_expected_declaration :=
    E'  v_manual_terminal_failed boolean := false;\n';
  v_expected_assignment :=
    v_manual_terminal_assignment
    || E'  UPDATE public.shipment_tracking_monitors AS monitor\n'
    || E'  SET state = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  v_expected_monitor_terminality :=
    E'SET state = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  v_expected_next_poll_terminality :=
    E'next_poll_at = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  v_expected_stopped_terminality :=
    E'stopped_at = CASE WHEN (v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  IF v_definition = v_original_definition
    OR pg_catalog.strpos(v_definition, v_selected_manual_scope) = 0
    OR pg_catalog.strpos(v_definition, v_unselected_manual_scope) <> 0
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
