CREATE OR REPLACE FUNCTION public.merge_transaction_metadata_by_reference(
  p_gateway_reference text,
  p_session_id text,
  p_order_id uuid,
  p_merchant_id uuid,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: merge_transaction_metadata_by_reference requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_gateway_reference IS NULL OR trim(p_gateway_reference) = '' THEN
    RAISE EXCEPTION 'gateway_reference_required'
      USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RAISE EXCEPTION 'session_id_required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
    updated_at = now()
  WHERE gateway_reference = p_gateway_reference
    AND order_id = p_order_id
    AND merchant_id = p_merchant_id
    AND status = 'pending'
    AND metadata->>'session_id' = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_transaction_metadata_by_reference(text, text, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_transaction_metadata_by_reference(text, text, uuid, uuid, jsonb) TO service_role;
