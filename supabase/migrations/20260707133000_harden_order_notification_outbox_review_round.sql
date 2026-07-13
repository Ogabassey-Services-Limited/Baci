-- Review-round hardening for order notification outbox semantics:
--   1. Manual shipped/delivered endpoints must not send while a matching
--      outbox row is pending/processing/sent.
--   2. Skipped rows are retryable after the merchant fixes the missing data.
--   3. Imported-order sync suppression must be explicit and transaction-local,
--      not based on the order's permanent external_source/import_job_id.

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

  IF current_setting('baci.order_notification_outbox.suppress_enqueue', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status THEN
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
    AND outbox.status IN ('pending', 'processing', 'sent')
  ORDER BY
    CASE outbox.status
      WHEN 'processing' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'sent' THEN 3
      ELSE 4
    END,
    outbox.updated_at DESC
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
  'Returns pending/processing/sent when a legacy manual shipped/delivered endpoint must not send because the transactional outbox owns the notification. Skipped/failed rows are retryable and return null.';

CREATE OR REPLACE FUNCTION public.replace_order_items_suppressing_order_notifications(
  p_order_id uuid,
  p_items jsonb,
  p_merchant_id uuid,
  p_order_patch jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('baci.order_notification_outbox.suppress_enqueue', 'true', true);
  PERFORM public.replace_order_items(
    p_order_id,
    p_items,
    p_merchant_id,
    TRUE,
    p_order_patch
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb
) TO service_role;

COMMENT ON FUNCTION public.replace_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb
) IS
  'Import-sync wrapper for replace_order_items. Suppresses fulfillment notification outbox enqueueing only for this transaction.';

CREATE OR REPLACE FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  p_order_id uuid,
  p_items jsonb,
  p_merchant_id uuid,
  p_order_patch jsonb,
  p_expected_updated_at timestamptz
)
RETURNS TABLE (
  id uuid,
  external_id text,
  tracking_token text,
  updated_at timestamptz,
  fulfillment_details jsonb,
  shipping_address jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('baci.order_notification_outbox.suppress_enqueue', 'true', true);

  RETURN QUERY
  SELECT
    replaced.id,
    replaced.external_id,
    replaced.tracking_token,
    replaced.updated_at,
    replaced.fulfillment_details,
    replaced.shipping_address
  FROM public.replace_imported_order_items(
    p_order_id,
    p_items,
    p_merchant_id,
    p_order_patch,
    p_expected_updated_at
  ) AS replaced;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb,
  timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb,
  timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb,
  timestamptz
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb,
  timestamptz
) TO service_role;

COMMENT ON FUNCTION public.replace_imported_order_items_suppressing_order_notifications(
  uuid,
  jsonb,
  uuid,
  jsonb,
  timestamptz
) IS
  'Import-sync wrapper for replace_imported_order_items. Suppresses fulfillment notification outbox enqueueing only for this transaction.';
