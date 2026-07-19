-- BNPL age starts when the provider session last moved, not when an old order
-- was originally created. A recent, explicit SDK-success review pauses
-- time-based cancellation for at most 14 days. Popup-only and cron/backfill
-- evidence does not hold an order open indefinitely.
CREATE OR REPLACE FUNCTION public.mark_abandoned_orders(hours_threshold int DEFAULT 72)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF hours_threshold IS NULL OR hours_threshold < 1 OR hours_threshold > 720 THEN
    RAISE EXCEPTION 'invalid_hours_threshold: % (expected 1-720)', hours_threshold
      USING ERRCODE = '22023';
  END IF;

  WITH cancelled_orders AS (
    UPDATE public.orders o
    SET
      payment_status = 'cancelled',
      shipping_status = CASE
        WHEN o.payment_status IN ('pending', 'bnpl_pending')
          AND o.payment_method IN ('credit_direct', 'klump')
        THEN 'cancelled'
        ELSE o.shipping_status
      END,
      cancelled_at = CASE
        WHEN o.payment_status IN ('pending', 'bnpl_pending')
          AND o.payment_method IN ('credit_direct', 'klump')
        THEN COALESCE(o.cancelled_at, now())
        ELSE o.cancelled_at
      END,
      updated_at = now()
    WHERE (
        (
          o.payment_status = 'unpaid'
          AND o.created_at < (now() - (hours_threshold * interval '1 hour'))
        )
        OR (
          o.payment_status IN ('pending', 'bnpl_pending')
          AND o.payment_method IN ('credit_direct', 'klump')
          AND o.updated_at < (now() - (hours_threshold * interval '1 hour'))
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.reconciliation_review rr
        WHERE o.payment_method = 'credit_direct'
          AND rr.order_id = o.id
          AND rr.issue_type = 'credit_direct_confirmation_missing'
          AND rr.resolved_at IS NULL
          AND rr.metadata->>'source' = 'credit_direct_sdk_on_success'
          AND (rr.metadata->>'client_completed_at')::timestamptz
            > (clock_timestamp() - interval '14 days')
      )
    RETURNING o.id, o.payment_method
  )
  UPDATE public.reconciliation_review rr
  SET resolved_at = clock_timestamp(),
      resolution_notes = COALESCE(
        rr.resolution_notes,
        'Provider confirmation deadline expired; order was cancelled as abandoned.'
      )
  FROM cancelled_orders c
  WHERE c.payment_method = 'credit_direct'
    AND rr.order_id = c.id
    AND rr.issue_type = 'credit_direct_confirmation_missing'
    AND rr.resolved_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.mark_abandoned_orders(integer) IS
  'Cancels stale unpaid/BNPL attempts while giving explicit Credit Direct SDK-success cases a bounded reconciliation window.';

REVOKE ALL ON FUNCTION public.mark_abandoned_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_orders(integer) TO service_role;
