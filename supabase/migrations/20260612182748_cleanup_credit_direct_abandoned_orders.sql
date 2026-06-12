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
  WHERE created_at < (now() - (hours_threshold || ' hours')::interval)
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
  'Marks stale unpaid orders and stale Credit Direct BNPL checkout sessions as cancelled. Threshold must be 1-720 hours.';

REVOKE ALL ON FUNCTION public.mark_abandoned_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_orders(integer) TO service_role;
