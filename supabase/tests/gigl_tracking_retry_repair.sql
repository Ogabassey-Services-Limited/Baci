DO $$
DECLARE
  sync_definition text;
  monitor_definition text;
  apply_definition text;
  apply_result jsonb;
  manual_failure_result jsonb;
  sync_result text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.sync_gigl_tracking_order_status()'::regprocedure
  ) INTO sync_definition;
  SELECT pg_catalog.pg_get_functiondef(
    'private.activate_gigl_tracking_monitor()'::regprocedure
  ) INTO monitor_definition;
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid,uuid,text,text,text,timestamptz,jsonb)'::regprocedure
  ) INTO apply_definition;

  IF sync_definition NOT LIKE '%newer_shipment.merchant_id = NEW.merchant_id%'
    OR sync_definition NOT LIKE '%newer_shipment.tracking_timeline_generation%'
    OR monitor_definition NOT LIKE '%NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id%'
    OR apply_definition NOT LIKE '%v_current_status = ''failed''%'
    OR apply_definition NOT LIKE '%v_effective_status = ''delivered''%'
    OR apply_definition NOT LIKE '%v_latest_status_event_at >= v_latest_persisted_status_event_at%'
    OR apply_definition LIKE '%v_latest_status_event_at >= v_latest_persisted_event_at%'
    OR apply_definition NOT LIKE '%v_manual_terminal_failed boolean := false%'
    OR apply_definition NOT LIKE '%OR v_manual_terminal_failed)%'
    OR apply_definition NOT LIKE '%v_latest_status_event_at <= v_manual_terminal_override_at%'
    OR apply_definition LIKE '%v_latest_incoming_event_at <= v_manual_terminal_override_at%'
    OR to_regprocedure(
      'public.reset_shipment_tracking_notification_dispatch(uuid,text)'
    ) IS NOT NULL THEN
    RAISE EXCEPTION 'GIGL recovery-edge repairs did not install the expected definitions';
  END IF;

  INSERT INTO public.shipments(
    id,
    order_id,
    merchant_id,
    tracking_timeline_generation
  ) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000021',
    1
  );

  SELECT result
  INTO sync_result
  FROM public.gigl_tracking_sync_probe
  ORDER BY result DESC
  LIMIT 1;
  IF sync_result IS DISTINCT FROM 'allowed' THEN
    RAISE EXCEPTION 'GIGL order status repair did not preserve merchant scope';
  END IF;

  SELECT public.apply_gigl_tracking_result(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000002',
    'in_transit',
    'WB-REPAIR-TEST',
    'GIGL',
    now(),
    '[]'::jsonb
  ) INTO apply_result;
  IF apply_result->>'effective_status' IS DISTINCT FROM 'in_transit'
    OR (apply_result->>'should_update_delivery')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'GIGL tracking retry repair did not change runtime behavior';
  END IF;

  SELECT public.apply_gigl_tracking_result(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000002',
    'failed',
    'WB-REPAIR-TEST',
    'GIGL',
    NULL,
    '[]'::jsonb
  ) INTO manual_failure_result;
  IF manual_failure_result->>'effective_status' IS DISTINCT FROM 'failed'
    OR (
      manual_failure_result->>'should_update_location'
    )::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'manual failed GIGL status must remain terminal';
  END IF;
END;
$$;
