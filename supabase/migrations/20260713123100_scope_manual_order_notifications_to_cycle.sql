-- Serialize manual fulfillment sends on the order aggregate and address only
-- the current durable fulfillment cycle.

CREATE OR REPLACE FUNCTION public.prepare_order_notification_outbox_manual_send(
  p_order_id uuid,
  p_merchant_id uuid,
  p_event_type text,
  p_tracking_number text DEFAULT NULL,
  p_courier_name text DEFAULT NULL,
  p_estimated_delivery text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_claim_owner text;
  v_fulfillment_cycle_id uuid;
  v_metadata jsonb;
  v_outbox_id uuid;
  v_order_shipping_status text;
  v_skip_reason text;
  v_status text;
BEGIN
  IF p_event_type NOT IN ('order_shipped', 'order_delivered') THEN
    RAISE EXCEPTION 'invalid order notification event type: %', p_event_type
      USING ERRCODE = '22023';
  END IF;

  IF v_auth_role IS DISTINCT FROM 'service_role' THEN
    IF v_auth_uid IS NULL OR NOT (
      EXISTS (
        SELECT 1
        FROM public.merchants AS merchants
        WHERE merchants.id = p_merchant_id
          AND merchants.user_id = v_auth_uid
      )
      OR EXISTS (
        SELECT 1
        FROM public.staff_members AS staff_members
        WHERE staff_members.merchant_id = p_merchant_id
          AND staff_members.user_id = v_auth_uid
          AND staff_members.status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'not authorized to prepare order notification outbox row'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT
    orders.shipping_status,
    orders.fulfillment_notification_cycle_id
  INTO v_order_shipping_status, v_fulfillment_cycle_id
  FROM public.orders AS orders
  WHERE orders.id = p_order_id
    AND orders.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'order_not_found', 'outbox_id', NULL);
  END IF;

  SELECT outbox.id, outbox.status, outbox.skip_reason, outbox.metadata
  INTO v_outbox_id, v_status, v_skip_reason, v_metadata
  FROM public.order_notification_outbox AS outbox
  WHERE outbox.order_id = p_order_id
    AND outbox.merchant_id = p_merchant_id
    AND outbox.event_type = p_event_type
    AND outbox.fulfillment_cycle_id = v_fulfillment_cycle_id
  ORDER BY outbox.event_sequence DESC
  LIMIT 1
  FOR UPDATE;

  IF v_status = 'pending' THEN
    IF p_event_type = 'order_shipped' THEN
      UPDATE public.order_notification_outbox AS outbox
      SET
        metadata = outbox.metadata || jsonb_strip_nulls(jsonb_build_object(
          'manual_tracking_number', nullif(btrim(p_tracking_number), ''),
          'manual_courier_name', nullif(btrim(p_courier_name), ''),
          'manual_estimated_delivery', nullif(btrim(p_estimated_delivery), '')
        )),
        updated_at = now()
      WHERE outbox.id = v_outbox_id;
    END IF;

    RETURN jsonb_build_object('status', v_status, 'outbox_id', v_outbox_id);
  END IF;

  IF v_status IN ('processing', 'sent') THEN
    RETURN jsonb_build_object('status', v_status, 'outbox_id', v_outbox_id);
  END IF;

  IF v_status = 'skipped' AND v_skip_reason = 'delivery_outcome_unknown' THEN
    RETURN jsonb_build_object(
      'status', 'outcome_unknown',
      'outbox_id', v_outbox_id
    );
  END IF;

  IF (
    p_event_type = 'order_shipped'
    AND v_order_shipping_status NOT IN ('shipped', 'out_for_delivery')
  )
    OR (
      p_event_type = 'order_delivered'
      AND v_order_shipping_status NOT IN ('delivered', 'completed')
    )
  THEN
    RETURN jsonb_build_object('status', 'invalid_state', 'outbox_id', NULL);
  END IF;

  v_claim_owner := 'manual-endpoint:' || gen_random_uuid()::text;

  IF v_status IN ('skipped', 'failed') THEN
    UPDATE public.order_notification_outbox AS outbox
    SET
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_at = now(),
      locked_by = v_claim_owner,
      metadata = CASE
        WHEN p_event_type = 'order_shipped'
        THEN outbox.metadata || jsonb_strip_nulls(jsonb_build_object(
          'manual_tracking_number', nullif(btrim(p_tracking_number), ''),
          'manual_courier_name', nullif(btrim(p_courier_name), ''),
          'manual_estimated_delivery', nullif(btrim(p_estimated_delivery), '')
        ))
        ELSE outbox.metadata
      END,
      updated_at = now()
    WHERE outbox.id = v_outbox_id
    RETURNING outbox.metadata INTO v_metadata;
  ELSE
    INSERT INTO public.order_notification_outbox (
      order_id,
      merchant_id,
      event_type,
      fulfillment_cycle_id,
      status,
      attempt_count,
      locked_at,
      locked_by,
      next_attempt_at,
      metadata
    )
    VALUES (
      p_order_id,
      p_merchant_id,
      p_event_type,
      v_fulfillment_cycle_id,
      'processing',
      1,
      now(),
      v_claim_owner,
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'source', 'manual_endpoint_claim',
        'manual_tracking_number', nullif(btrim(p_tracking_number), ''),
        'manual_courier_name', nullif(btrim(p_courier_name), ''),
        'manual_estimated_delivery', nullif(btrim(p_estimated_delivery), '')
      ))
    )
    RETURNING id, metadata INTO v_outbox_id, v_metadata;
  END IF;

  RETURN jsonb_build_object(
    'status', NULL,
    'outbox_id', v_outbox_id,
    'claim_owner', v_claim_owner,
    'metadata', v_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_order_notification_outbox_manual_send(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_order_notification_outbox_manual_send(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.prepare_order_notification_outbox_manual_send(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) IS
  'Claims only the current fulfillment cycle and only enriches pending notification payloads before dispatch.';
