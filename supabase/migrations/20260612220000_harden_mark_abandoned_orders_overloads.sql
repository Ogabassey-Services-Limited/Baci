-- Remove a possible pre-baseline zero-argument overload. PostgreSQL function
-- identity includes input argument types, so this does not affect the intended
-- public.mark_abandoned_orders(integer) cron RPC.
DROP FUNCTION IF EXISTS public.mark_abandoned_orders();

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

  UPDATE public.orders
  SET
    payment_status = 'cancelled',
    updated_at = now()
  WHERE created_at < (now() - (hours_threshold * interval '1 hour'))
    AND (
      payment_status = 'unpaid'
      OR (
        payment_method = 'credit_direct'
        AND payment_status = 'bnpl_pending'
      )
    );
END;
$$;

COMMENT ON FUNCTION public.mark_abandoned_orders(integer) IS
  'Cancels stale unpaid and Credit Direct BNPL pending orders. Invoked only by trusted cron cleanup code.';

REVOKE ALL ON FUNCTION public.mark_abandoned_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_orders(integer) TO service_role;
