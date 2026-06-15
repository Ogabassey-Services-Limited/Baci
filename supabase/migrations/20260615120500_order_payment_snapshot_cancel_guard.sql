-- Extend get_order_payment_snapshot to expose order status so payment-start
-- paths can reject a cancelled order. The previous signature returned only
-- merchant_id/total/currency/tracking_token, so the initialize route could not
-- tell that an order had been cancelled.
--
-- Changing a RETURNS TABLE shape requires DROP + recreate (not CREATE OR
-- REPLACE). Callers: the payments/initialize route and the
-- payments/credit-direct/sign route (both admin client), which now reject a
-- cancelled order using the returned shipping_status.

DROP FUNCTION IF EXISTS public.get_order_payment_snapshot(uuid, text);

CREATE FUNCTION public.get_order_payment_snapshot(
  p_order_id uuid,
  p_email text
)
RETURNS TABLE(
  merchant_id uuid,
  total numeric,
  currency text,
  tracking_token text,
  shipping_status text,
  payment_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.merchant_id,
    o.total,
    o.currency,
    o.tracking_token,
    o.shipping_status,
    o.payment_status
  FROM public.orders o
  WHERE o.id = p_order_id
    AND lower(o.customer_email) = lower(trim(p_email))
  LIMIT 1;
$$;

ALTER FUNCTION public.get_order_payment_snapshot(uuid, text) OWNER TO postgres;

-- Recreate drops prior ACL and re-grants EXECUTE to PUBLIC by default; lock that
-- down and re-grant only the roles that had it before. (The function filters
-- strictly by order_id + lower(email), but keep the least-privilege posture.)
REVOKE ALL ON FUNCTION public.get_order_payment_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_payment_snapshot(uuid, text)
  TO anon, authenticated, service_role;
