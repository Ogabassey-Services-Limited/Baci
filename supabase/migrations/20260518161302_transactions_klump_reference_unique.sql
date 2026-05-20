-- Klump needs a gateway-wide merchant reference so the browser callback can
-- record Klump's transaction id before server-side verification. Keep the
-- uniqueness narrow to Klump so existing gateway semantics are untouched.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_klump_gateway_reference_unique_idx
  ON public.transactions (gateway_reference)
  WHERE gateway_reference IS NOT NULL
    AND gateway = 'klump';

CREATE OR REPLACE FUNCTION public.record_klump_transaction_id(
  p_merchant_reference text,
  p_klump_transaction_id text,
  p_tracking_token text
) RETURNS TABLE(code text, transaction_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match_count integer;
  v_transaction_id uuid;
  v_transaction_merchant_id uuid;
  v_order_id uuid;
  v_order_merchant_id uuid;
  v_order_tracking_token text;
  v_existing_klump_transaction_id text;
BEGIN
  SELECT count(*)
    INTO v_match_count
  FROM public.transactions t
  WHERE t.gateway = 'klump'
    AND t.gateway_reference = p_merchant_reference;

  IF v_match_count = 0 THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_match_count > 1 THEN
    RETURN QUERY SELECT 'REFERENCE_NOT_UNIQUE'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT
    t.id,
    t.merchant_id,
    t.order_id,
    o.merchant_id,
    o.tracking_token,
    t.metadata->>'klump_transaction_id'
  INTO
    v_transaction_id,
    v_transaction_merchant_id,
    v_order_id,
    v_order_merchant_id,
    v_order_tracking_token,
    v_existing_klump_transaction_id
  FROM public.transactions t
  LEFT JOIN public.orders o ON o.id = t.order_id
  WHERE t.gateway = 'klump'
    AND t.gateway_reference = p_merchant_reference
  FOR UPDATE OF t;

  IF v_order_id IS NULL
    OR v_order_merchant_id IS NULL
    OR v_order_merchant_id IS DISTINCT FROM v_transaction_merchant_id
    OR v_order_tracking_token IS DISTINCT FROM p_tracking_token
  THEN
    RETURN QUERY SELECT 'UNAUTHORIZED'::text, v_transaction_id;
    RETURN;
  END IF;

  IF v_existing_klump_transaction_id IS NOT NULL
    AND v_existing_klump_transaction_id = p_klump_transaction_id
  THEN
    RETURN QUERY SELECT 'OK'::text, v_transaction_id;
    RETURN;
  END IF;

  IF v_existing_klump_transaction_id IS NOT NULL
    AND v_existing_klump_transaction_id <> p_klump_transaction_id
  THEN
    RETURN QUERY SELECT 'KLUMP_ID_CONFLICT'::text, v_transaction_id;
    RETURN;
  END IF;

  UPDATE public.transactions
  SET
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{klump_transaction_id}',
      to_jsonb(p_klump_transaction_id),
      true
    ),
    updated_at = now()
  WHERE id = v_transaction_id
    AND gateway = 'klump';

  RETURN QUERY SELECT 'OK'::text, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_klump_transaction_id(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_klump_transaction_id(text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.record_klump_transaction_id(text, text, text) IS
  'Records Klump transaction id metadata for a BAC merchant reference after validating the joined order tracking token and tenant match; does not mark orders paid.';
