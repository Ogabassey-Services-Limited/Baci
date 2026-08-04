-- Append-only repair for the failed GIGL notification-recovery-edge migration.
--
-- 20260801142000_harden_gigl_notification_recovery_edges.sql remains
-- immutable. Its adjacent PostgreSQL escape-string literals were rejected
-- before it could be recorded. The deployment applier runs this correction at
-- the historical source position after verifying the exact source checksum.

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
  v_expected_terminality text;
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
    E'v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'(v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
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
  v_expected_terminality :=
    E'(v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
    || E'      OR v_manual_terminal_failed)';
  IF v_definition = v_original_definition
    OR pg_catalog.strpos(v_definition, v_expected_declaration) = 0
    OR pg_catalog.strpos(v_definition, v_expected_assignment) = 0
    OR pg_catalog.strpos(v_definition, v_expected_terminality) = 0 THEN
    RAISE EXCEPTION 'GIGL manual failed terminal state hardening did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
