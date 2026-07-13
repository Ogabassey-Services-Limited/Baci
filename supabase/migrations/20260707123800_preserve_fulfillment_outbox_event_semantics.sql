-- Preserve event semantics for the fulfillment notification outbox:
--   1. delivered -> completed is a status normalization, not a second
--      delivered notification event.
--   2. Manual shipped/delivered endpoints may consume queued rows only while
--      they are pending. Processing rows are already claimed by cron workers.

CREATE OR REPLACE FUNCTION public.enqueue_order_fulfillment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status THEN
    RETURN NEW;
  END IF;

  IF NEW.external_source IS NOT NULL OR NEW.import_job_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.shipping_status IN ('delivered', 'completed')
    AND NEW.shipping_status IN ('delivered', 'completed')
  THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status = 'shipped' THEN
    v_event_type := 'order_shipped';
  ELSIF NEW.shipping_status IN ('delivered', 'completed') THEN
    v_event_type := 'order_delivered';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.order_notification_outbox (
    order_id,
    merchant_id,
    event_type,
    next_attempt_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.merchant_id,
    v_event_type,
    now(),
    jsonb_build_object(
      'previous_shipping_status', OLD.shipping_status,
      'shipping_status', NEW.shipping_status,
      'source', 'orders_shipping_status_trigger'
    )
  )
  ON CONFLICT (order_id, event_type)
    WHERE status IN ('pending', 'processing')
    DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_fulfillment_notification() FROM PUBLIC;

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

  UPDATE public.order_notification_outbox AS outbox
  SET
    status = p_status,
    sent_at = CASE
      WHEN p_status = 'sent' THEN now()
      ELSE outbox.sent_at
    END,
    skipped_at = CASE
      WHEN p_status = 'skipped' THEN now()
      ELSE outbox.skipped_at
    END,
    skip_reason = CASE
      WHEN p_status = 'skipped' THEN coalesce(p_skip_reason, 'manual_endpoint_skipped')
      ELSE NULL
    END,
    last_error = NULL,
    locked_at = NULL,
    locked_by = NULL,
    metadata = outbox.metadata || jsonb_strip_nulls(jsonb_build_object(
      'manual_endpoint_completed_at', now(),
      'manual_endpoint_message_id', p_message_id
    )),
    updated_at = now()
  WHERE outbox.order_id = p_order_id
    AND outbox.merchant_id = p_merchant_id
    AND outbox.event_type = p_event_type
    AND outbox.status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
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
  'Marks pending fulfillment-notification outbox rows consumed by legacy manual shipped/delivered email endpoints. Cron-claimed processing rows are left untouched.';
