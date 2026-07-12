-- Complete only the latest fulfillment event cycle. A cron-owned processing
-- row or an already-sent latest row must never cause the manual endpoint to
-- insert a competing terminal marker.

CREATE OR REPLACE FUNCTION public.complete_order_notification_outbox_manual_result(
  p_order_id uuid,
  p_merchant_id uuid,
  p_event_type text,
  p_status text,
  p_message_id text DEFAULT NULL,
  p_skip_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_auth_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  IF p_event_type NOT IN ('order_shipped', 'order_delivered') THEN
    RAISE EXCEPTION 'invalid order notification event type: %', p_event_type
      USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('sent', 'skipped') THEN
    RAISE EXCEPTION 'invalid manual order notification status: %', p_status
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
      RAISE EXCEPTION 'not authorized to complete order notification outbox row'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH latest AS (
    SELECT outbox.id, outbox.status
    FROM public.order_notification_outbox AS outbox
    WHERE outbox.order_id = p_order_id
      AND outbox.merchant_id = p_merchant_id
      AND outbox.event_type = p_event_type
    ORDER BY outbox.event_sequence DESC
    LIMIT 1
    FOR UPDATE
  ), updated AS (
    UPDATE public.order_notification_outbox AS outbox
    SET
      status = p_status,
      sent_at = CASE
        WHEN p_status = 'sent' THEN now()
        ELSE outbox.sent_at
      END,
      skipped_at = CASE
        WHEN p_status = 'skipped' THEN now()
        ELSE NULL
      END,
      skip_reason = CASE
        WHEN p_status = 'skipped' THEN coalesce(p_skip_reason, 'manual_endpoint_skipped')
        ELSE NULL
      END,
      last_error = NULL,
      next_attempt_at = NULL,
      locked_at = NULL,
      locked_by = NULL,
      metadata = outbox.metadata || jsonb_strip_nulls(jsonb_build_object(
        'manual_endpoint_completed_at', now(),
        'manual_endpoint_message_id', p_message_id,
        'manual_endpoint_retry_source_status', outbox.status
      )),
      updated_at = now()
    FROM latest
    WHERE outbox.id = latest.id
      AND (
        latest.status IN ('pending', 'skipped', 'failed')
        OR (
          latest.status = 'processing'
          AND outbox.locked_by = 'manual-endpoint'
        )
      )
    RETURNING outbox.id
  ), inserted AS (
    INSERT INTO public.order_notification_outbox (
      order_id,
      merchant_id,
      event_type,
      status,
      sent_at,
      skipped_at,
      skip_reason,
      next_attempt_at,
      metadata
    )
    SELECT
      p_order_id,
      p_merchant_id,
      p_event_type,
      p_status,
      CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
      CASE WHEN p_status = 'skipped' THEN now() ELSE NULL END,
      CASE WHEN p_status = 'skipped'
        THEN coalesce(p_skip_reason, 'manual_endpoint_skipped')
        ELSE NULL
      END,
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'source', 'manual_endpoint_completion',
        'manual_endpoint_completed_at', now(),
        'manual_endpoint_message_id', p_message_id
      ))
    WHERE NOT EXISTS (SELECT 1 FROM latest)
    RETURNING id
  )
  SELECT count(*)::integer
  INTO v_updated_count
  FROM (
    SELECT id FROM updated
    UNION ALL
    SELECT id FROM inserted
  ) AS completed_rows;

  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order_notification_outbox_manual_result(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order_notification_outbox_manual_result(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.complete_order_notification_outbox_manual_result(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) IS
  'Records manual fulfillment outcomes against only the latest event cycle; processing and sent rows remain untouched.';
