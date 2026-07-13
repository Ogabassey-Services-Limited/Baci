-- Let legacy manual shipped/delivered endpoints check whether the outbox has
-- already reached a terminal sent/skipped state before they send again.

CREATE OR REPLACE FUNCTION public.get_order_notification_outbox_manual_terminal_status(
  p_order_id uuid,
  p_merchant_id uuid,
  p_event_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
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
      RAISE EXCEPTION 'not authorized to read order notification outbox state'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT outbox.status
  INTO v_status
  FROM public.order_notification_outbox AS outbox
  WHERE outbox.order_id = p_order_id
    AND outbox.merchant_id = p_merchant_id
    AND outbox.event_type = p_event_type
    AND outbox.status IN ('sent', 'skipped')
  ORDER BY outbox.updated_at DESC
  LIMIT 1;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_notification_outbox_manual_terminal_status(
  uuid,
  uuid,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_notification_outbox_manual_terminal_status(
  uuid,
  uuid,
  text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_order_notification_outbox_manual_terminal_status(
  uuid,
  uuid,
  text
) IS
  'Returns sent/skipped when a legacy manual shipped/delivered endpoint should not send because the outbox already completed the notification.';
