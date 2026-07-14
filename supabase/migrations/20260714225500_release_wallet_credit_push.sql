CREATE OR REPLACE FUNCTION public.claim_wallet_credit_push_v2(
  p_transaction_id uuid,
  p_claim_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed boolean;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_wallet_credit_push_v2 requires service_role';
  END IF;

  UPDATE public.transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'wallet_credit_push_scheduled_at', statement_timestamp(),
    'wallet_credit_push_claim_token', p_claim_token
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

REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wallet_credit_push_v2(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_wallet_credit_push(
  p_transaction_id uuid,
  p_claim_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  released boolean;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: release_wallet_credit_push requires service_role';
  END IF;

  UPDATE public.transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb)
    - 'wallet_credit_push_scheduled_at'
  WHERE id = p_transaction_id
    AND COALESCE(metadata, '{}'::jsonb)
      ? 'wallet_credit_push_scheduled_at'
    AND COALESCE(metadata, '{}'::jsonb)
      ->> 'wallet_credit_push_claim_token' = p_claim_token
  RETURNING true INTO released;

  RETURN COALESCE(released, false);
END;
$$;

REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.release_wallet_credit_push(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_wallet_credit_push(uuid, text) TO service_role;
