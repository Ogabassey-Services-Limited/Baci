DO $$
BEGIN
  IF (SELECT state
      FROM public.shipment_tracking_monitors
      WHERE shipment_id = '00000000-0000-0000-0000-000000000101') IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'unowned GIGL monitor was not deactivated';
  END IF;

  IF (SELECT state
      FROM public.shipment_tracking_monitors
      WHERE shipment_id = '00000000-0000-0000-0000-000000000102') IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'owned GIGL monitor was changed unexpectedly';
  END IF;
END;
$$;
