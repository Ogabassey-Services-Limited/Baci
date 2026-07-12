-- ZeptoMail does not provide an idempotency key for transactional sends.
-- A processing lease alone is safe to reclaim, but a lease whose provider
-- dispatch has started can represent an accepted email whose terminal outbox
-- write was lost. Track that boundary explicitly so unstarted work is retried
-- while indeterminate sends remain at-most-once.

ALTER TABLE public.order_notification_outbox
  ADD COLUMN IF NOT EXISTS dispatch_started_at timestamptz;

COMMENT ON COLUMN public.order_notification_outbox.dispatch_started_at IS
  'Set immediately before an external email dispatch; stale marked rows have an indeterminate delivery outcome and are never resent automatically.';

CREATE OR REPLACE FUNCTION public.reset_order_notification_dispatch_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'processing')
    AND NEW.status IS DISTINCT FROM OLD.status
  THEN
    NEW.dispatch_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_order_notification_dispatch_boundary()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS order_notification_outbox_reset_dispatch_boundary
  ON public.order_notification_outbox;
CREATE TRIGGER order_notification_outbox_reset_dispatch_boundary
  BEFORE UPDATE OF status ON public.order_notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_order_notification_dispatch_boundary();

CREATE OR REPLACE FUNCTION public.begin_order_notification_outbox_dispatch(
  p_outbox_id uuid,
  p_order_id uuid,
  p_merchant_id uuid,
  p_event_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_updated_count integer := 0;
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
      RAISE EXCEPTION 'not authorized to begin order notification dispatch'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.order_notification_outbox AS outbox
  SET
    dispatch_started_at = now(),
    updated_at = now()
  WHERE outbox.id = p_outbox_id
    AND outbox.order_id = p_order_id
    AND outbox.merchant_id = p_merchant_id
    AND outbox.event_type = p_event_type
    AND outbox.status = 'processing'
    AND (
      v_auth_role = 'service_role'
      OR outbox.locked_by = 'manual-endpoint'
    )
    AND outbox.dispatch_started_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_order_notification_outbox_dispatch(
  uuid,
  uuid,
  uuid,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_order_notification_outbox_dispatch(
  uuid,
  uuid,
  uuid,
  text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.begin_order_notification_outbox_dispatch(
  uuid,
  uuid,
  uuid,
  text
) IS
  'Marks the exact claimed fulfillment notification immediately before provider dispatch.';

CREATE OR REPLACE FUNCTION public.claim_order_notification_outbox(
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
  UPDATE public.order_notification_outbox AS outbox
  SET
    status = 'skipped',
    skip_reason = 'delivery_outcome_unknown',
    skipped_at = now(),
    next_attempt_at = NULL,
    locked_at = NULL,
    locked_by = NULL,
    last_error = coalesce(
      outbox.last_error,
      'worker_abandoned_delivery_outcome_unknown'
    ),
    updated_at = now()
  WHERE outbox.status = 'processing'
    AND outbox.dispatch_started_at IS NOT NULL
    AND outbox.locked_at < now() - interval '15 minutes';

  -- No provider dispatch began, so this abandoned lease is safe to retry and
  -- should not consume a delivery attempt.
  UPDATE public.order_notification_outbox AS outbox
  SET
    status = 'pending',
    attempt_count = greatest(0, outbox.attempt_count - 1),
    next_attempt_at = now(),
    locked_at = NULL,
    locked_by = NULL,
    last_error = coalesce(outbox.last_error, 'worker_abandoned_before_dispatch'),
    updated_at = now()
  WHERE outbox.status = 'processing'
    AND outbox.dispatch_started_at IS NULL
    AND outbox.locked_at < now() - interval '15 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
    FROM public.order_notification_outbox AS outbox
    WHERE outbox.status = 'pending'
      AND outbox.attempt_count < outbox.max_attempts
      AND coalesce(outbox.next_attempt_at, now()) <= now()
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

REVOKE ALL ON FUNCTION public.claim_order_notification_outbox(integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_notification_outbox(integer, text)
  TO service_role;

COMMENT ON FUNCTION public.claim_order_notification_outbox(integer, text) IS
  'Atomically terminalizes stale indeterminate dispatches, then claims due pending fulfillment notifications in event order.';
