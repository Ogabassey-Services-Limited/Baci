DO $$
DECLARE
  sync_definition text;
  apply_definition text;
  apply_result jsonb;
  sync_result text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.sync_gigl_tracking_order_status()'::regprocedure
  ) INTO sync_definition;
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid,uuid,text,text,text,timestamptz,jsonb)'::regprocedure
  ) INTO apply_definition;

  IF sync_definition NOT LIKE '%newer_shipment.merchant_id = NEW.merchant_id%'
    OR sync_definition NOT LIKE '%newer_shipment.tracking_timeline_generation%'
    OR apply_definition NOT LIKE '%v_current_status = ''failed''%'
    OR apply_definition NOT LIKE '%v_effective_status = ''delivered''%' THEN
    RAISE EXCEPTION 'GIGL retry repair did not install both function definitions';
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
END;
$$;
