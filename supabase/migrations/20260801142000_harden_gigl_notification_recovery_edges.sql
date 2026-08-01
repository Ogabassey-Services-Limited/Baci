-- Remove the unapproved dispatch-reset RPC and keep manual failure and tenant
-- boundaries intact while GIGL tracking notifications recover.

DROP FUNCTION IF EXISTS public.reset_shipment_tracking_notification_dispatch(
  uuid, text
);

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'private.activate_gigl_tracking_monitor()'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN',
    E'     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id\n'
      E'     AND NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id%' THEN
    RAISE EXCEPTION 'GIGL monitor identity must include merchant ownership';
  END IF;
  EXECUTE v_definition;
END;
$migration$;

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
    E'  v_should_update_delivery boolean := false;\n',
    E'  v_should_update_delivery boolean := false;\n'
      E'  v_manual_terminal_failed boolean := false;\n'
  );
  v_definition := replace(
    v_definition,
    E'  v_should_update_location := v_current_location IS NOT NULL\n',
    E'  v_manual_terminal_failed := v_effective_status = ''failed''\n'
      E'    AND v_manual_terminal_override_at IS NOT NULL\n'
      E'    AND (\n'
      E'      v_latest_incoming_event_at IS NULL\n'
      E'      OR v_latest_incoming_event_at <= v_manual_terminal_override_at\n'
      E'    );\n'
      E'  v_should_update_location := v_current_location IS NOT NULL\n'
  );
  v_definition := replace(
    v_definition,
    E'v_effective_status IN (''delivered'', ''cancelled'', ''returned'')',
    E'(v_effective_status IN (''delivered'', ''cancelled'', ''returned'')\n'
      E'      OR v_manual_terminal_failed)'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%v_manual_terminal_failed%'
    OR v_definition NOT LIKE '%v_latest_incoming_event_at <= v_manual_terminal_override_at%' THEN
    RAISE EXCEPTION 'GIGL manual failed terminal state hardening did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
