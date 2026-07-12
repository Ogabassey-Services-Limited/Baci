-- Final review hardening for fulfillment notification delivery:
--   1. Manual retry decisions follow the latest event row, not any historical
--      sent marker from a prior re-shipment/re-delivery cycle.
--   2. Legacy shipped endpoint details enrich a pending outbox event so the
--      asynchronous sender preserves the caller's tracking payload.
--   3. Claimed rows expose immutable event metadata to the worker.

-- Add the ordering key without an identity/NOT NULL constraint first so this
-- migration remains safe when earlier outbox migrations have already queued
-- rows. The owned sequence provides the same monotonic insertion ordering for
-- both backfilled and future events.
CREATE SEQUENCE IF NOT EXISTS public.order_notification_outbox_event_sequence_seq;

ALTER TABLE public.order_notification_outbox
  ADD COLUMN IF NOT EXISTS event_sequence bigint;

ALTER SEQUENCE public.order_notification_outbox_event_sequence_seq
  OWNED BY public.order_notification_outbox.event_sequence;

ALTER TABLE public.order_notification_outbox
  ALTER COLUMN event_sequence SET DEFAULT
    nextval('public.order_notification_outbox_event_sequence_seq'::regclass);

WITH ordered_existing_rows AS (
  SELECT
    outbox.id,
    nextval('public.order_notification_outbox_event_sequence_seq'::regclass)
      AS event_sequence
  FROM public.order_notification_outbox AS outbox
  WHERE outbox.event_sequence IS NULL
  ORDER BY outbox.created_at ASC, outbox.id ASC
)
UPDATE public.order_notification_outbox AS outbox
SET event_sequence = ordered_existing_rows.event_sequence
FROM ordered_existing_rows
WHERE outbox.id = ordered_existing_rows.id;

SELECT setval(
  'public.order_notification_outbox_event_sequence_seq'::regclass,
  greatest(
    coalesce((SELECT max(outbox.event_sequence) FROM public.order_notification_outbox AS outbox), 0),
    1
  ),
  EXISTS (SELECT 1 FROM public.order_notification_outbox)
);

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
  ORDER BY outbox.event_sequence DESC
  LIMIT 1;

  IF v_status IN ('pending', 'processing', 'sent') THEN
    RETURN v_status;
  END IF;

  RETURN NULL;
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

DROP FUNCTION IF EXISTS public.prepare_order_notification_outbox_manual_send(
  uuid,
  uuid,
  text,
  text,
  text,
  text
);

CREATE FUNCTION public.prepare_order_notification_outbox_manual_send(
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
  v_claimed boolean := false;
  v_outbox_id uuid;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS orders
    WHERE orders.id = p_order_id
      AND orders.merchant_id = p_merchant_id
  ) THEN
    RETURN jsonb_build_object('status', 'order_not_found', 'outbox_id', NULL);
  END IF;

  SELECT outbox.id, outbox.status, outbox.skip_reason
  INTO v_outbox_id, v_status, v_skip_reason
  FROM public.order_notification_outbox AS outbox
  WHERE outbox.order_id = p_order_id
    AND outbox.merchant_id = p_merchant_id
    AND outbox.event_type = p_event_type
  ORDER BY outbox.event_sequence DESC
  LIMIT 1
  FOR UPDATE;

  IF v_outbox_id IS NOT NULL
    AND p_event_type = 'order_shipped'
    AND (
      nullif(btrim(p_tracking_number), '') IS NOT NULL
      OR nullif(btrim(p_courier_name), '') IS NOT NULL
      OR nullif(btrim(p_estimated_delivery), '') IS NOT NULL
    )
  THEN
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

  IF v_status IN ('pending', 'processing', 'sent') THEN
    RETURN jsonb_build_object('status', v_status, 'outbox_id', v_outbox_id);
  END IF;

  IF v_status = 'skipped' AND v_skip_reason = 'delivery_outcome_unknown' THEN
    RETURN jsonb_build_object(
      'status',
      'outcome_unknown',
      'outbox_id',
      v_outbox_id
    );
  END IF;

  IF v_status IN ('skipped', 'failed') THEN
    UPDATE public.order_notification_outbox AS outbox
    SET
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_at = now(),
      locked_by = 'manual-endpoint',
      updated_at = now()
    WHERE outbox.id = v_outbox_id;
    v_claimed := true;
  ELSE
    INSERT INTO public.order_notification_outbox (
      order_id,
      merchant_id,
      event_type,
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
      'processing',
      1,
      now(),
      'manual-endpoint',
      NULL,
      jsonb_strip_nulls(jsonb_build_object(
        'source', 'manual_endpoint_claim',
        'manual_tracking_number', nullif(btrim(p_tracking_number), ''),
        'manual_courier_name', nullif(btrim(p_courier_name), ''),
        'manual_estimated_delivery', nullif(btrim(p_estimated_delivery), '')
      ))
    )
    ON CONFLICT (order_id, event_type)
      WHERE status IN ('pending', 'processing')
      DO NOTHING
    RETURNING id INTO v_outbox_id;

    IF v_outbox_id IS NULL THEN
      SELECT outbox.id, outbox.status
      INTO v_outbox_id, v_status
      FROM public.order_notification_outbox AS outbox
      WHERE outbox.order_id = p_order_id
        AND outbox.merchant_id = p_merchant_id
        AND outbox.event_type = p_event_type
        AND outbox.status IN ('pending', 'processing')
      ORDER BY outbox.event_sequence DESC
      LIMIT 1;

      IF v_outbox_id IS NOT NULL AND p_event_type = 'order_shipped' THEN
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
    v_claimed := true;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_claimed THEN NULL ELSE v_status END,
    'outbox_id', v_outbox_id
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
  'Returns the latest blocking outbox state and atomically enriches pending shipped events with legacy manual endpoint details.';

-- A direct processing -> out_for_delivery transition represents the same
-- customer-visible shipment event as processing -> shipped. Do not enqueue a
-- second shipped event when an order merely advances shipped -> out_for_delivery.
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

  IF (NEW.shipping_status = 'shipped' AND OLD.shipping_status <> 'out_for_delivery')
    OR (
      NEW.shipping_status = 'out_for_delivery'
      AND OLD.shipping_status NOT IN ('shipped', 'out_for_delivery', 'delivered', 'completed')
    )
  THEN
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

DROP FUNCTION IF EXISTS public.claim_order_notification_outbox(integer, text);

CREATE FUNCTION public.claim_order_notification_outbox(
  p_batch_size integer DEFAULT 25,
  p_worker_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  merchant_id uuid,
  event_type text,
  attempt_count integer,
  max_attempts integer,
  metadata jsonb,
  event_sequence bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 25), 100));
  v_worker_id text := coalesce(nullif(btrim(p_worker_id), ''), 'order-notifications-worker');
BEGIN
  -- A worker may disappear after the provider accepted the final attempt but
  -- before the terminal write. Never resend that indeterminate delivery.
  UPDATE public.order_notification_outbox AS outbox
  SET
    status = 'skipped',
    skip_reason = 'delivery_outcome_unknown',
    skipped_at = now(),
    next_attempt_at = NULL,
    locked_at = NULL,
    locked_by = NULL,
    last_error = coalesce(outbox.last_error, 'worker_abandoned_final_attempt'),
    updated_at = now()
  WHERE outbox.status = 'processing'
    AND outbox.attempt_count >= outbox.max_attempts
    AND outbox.locked_at < now() - interval '15 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
    FROM public.order_notification_outbox AS outbox
    WHERE (
        outbox.status = 'pending'
        AND outbox.attempt_count < outbox.max_attempts
        AND coalesce(outbox.next_attempt_at, now()) <= now()
      )
      OR (
        outbox.status = 'processing'
        AND outbox.attempt_count < outbox.max_attempts
        AND outbox.locked_at < now() - interval '15 minutes'
      )
    ORDER BY outbox.event_sequence ASC
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.order_notification_outbox AS outbox
    SET
      status = 'processing',
      locked_at = now(),
      locked_by = v_worker_id,
      attempt_count = outbox.attempt_count + 1,
      updated_at = now()
    FROM candidates
    WHERE outbox.id = candidates.id
    RETURNING
      outbox.id,
      outbox.order_id,
      outbox.merchant_id,
      outbox.event_type,
      outbox.attempt_count,
      outbox.max_attempts,
      outbox.metadata,
      outbox.event_sequence
  )
  SELECT
    claimed.id,
    claimed.order_id,
    claimed.merchant_id,
    claimed.event_type,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.metadata,
    claimed.event_sequence
  FROM claimed
  ORDER BY claimed.event_sequence ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_notification_outbox(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_notification_outbox(integer, text) TO service_role;

COMMENT ON FUNCTION public.claim_order_notification_outbox(integer, text) IS
  'Atomically claims pending order fulfillment notification rows and returns their event metadata using FOR UPDATE SKIP LOCKED.';
