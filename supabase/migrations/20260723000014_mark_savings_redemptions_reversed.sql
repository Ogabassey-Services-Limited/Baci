-- Atomically records restoration of an order's redeemed savings after a PayPal
-- cancellation refund. The conditional UPDATE is rechecked after row-lock
-- waits, so concurrent retries cannot overwrite the first audit time or reason.

CREATE OR REPLACE FUNCTION public.mark_customer_savings_redemptions_reversed(
  p_merchant_id uuid,
  p_order_id uuid,
  p_reason text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated_rows bigint;
BEGIN
  IF p_merchant_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'merchant id and order id are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR pg_catalog.length(pg_catalog.btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reversal reason is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_savings_redemptions AS csr
  SET metadata = csr.metadata || pg_catalog.jsonb_build_object(
    'reversed_at', pg_catalog.clock_timestamp(),
    'reversed_reason', p_reason
  )
  WHERE csr.merchant_id = p_merchant_id
    AND csr.order_id = p_order_id
    AND csr.metadata->>'reversed_at' IS NULL;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.customer_savings_redemptions AS csr
    WHERE csr.merchant_id = p_merchant_id
      AND csr.order_id = p_order_id
      AND csr.metadata->>'reversed_at' IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'savings redemption not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated_rows;
END;
$$;

ALTER FUNCTION public.mark_customer_savings_redemptions_reversed(
  uuid, uuid, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.mark_customer_savings_redemptions_reversed(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_customer_savings_redemptions_reversed(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_customer_savings_redemptions_reversed(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_savings_redemptions_reversed(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.mark_customer_savings_redemptions_reversed(
  uuid, uuid, text
) IS 'Atomically records the first savings redemption reversal audit for an order. service_role only.';
