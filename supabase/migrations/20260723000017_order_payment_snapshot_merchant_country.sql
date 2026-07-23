-- Include the merchant's country in the existing email-bound payment snapshot
-- so public checkout routes do not need an unrestricted service-role query on
-- public.merchants. Credentials and payment configuration remain excluded.

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
  payment_status text,
  merchant_country text
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
    o.payment_status,
    m.country AS merchant_country
  FROM public.orders AS o
  JOIN public.merchants AS m ON m.id = o.merchant_id
  WHERE o.id = p_order_id
    AND pg_catalog.lower(o.customer_email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  LIMIT 1;
$$;

ALTER FUNCTION public.get_order_payment_snapshot(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_order_payment_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_payment_snapshot(uuid, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_order_payment_snapshot(uuid, text) IS
  'Returns a bounded order payment snapshot, including merchant country, when order id and customer email match.';
