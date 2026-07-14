CREATE OR REPLACE FUNCTION public.claim_wallet_credit_push(
  p_transaction_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  claimed boolean;
BEGIN
  UPDATE public.transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'wallet_credit_push_scheduled_at',
    statement_timestamp()
  )
  WHERE id = p_transaction_id
    AND NOT (
      COALESCE(metadata, '{}'::jsonb)
      ? 'wallet_credit_push_scheduled_at'
    )
  RETURNING true INTO claimed;

  RETURN COALESCE(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_wallet_credit_push(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_wallet_credit_push(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_wallet_credit_push(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wallet_credit_push(uuid) TO service_role;
