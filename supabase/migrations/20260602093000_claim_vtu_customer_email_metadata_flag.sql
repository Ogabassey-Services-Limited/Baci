CREATE OR REPLACE FUNCTION public.claim_vtu_customer_email_metadata_flag(
  p_transaction_id uuid,
  p_attempt_key text,
  p_sent_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_metadata jsonb;
BEGIN
  IF p_attempt_key NOT IN (
    'customerEmailNotificationAttempted',
    'customerPendingTokenEmailNotificationAttempted'
  ) THEN
    RAISE EXCEPTION 'unsupported_email_attempt_metadata_key';
  END IF;

  IF p_sent_key NOT IN (
    'customerEmailNotificationSent',
    'customerPendingTokenEmailNotificationSent'
  ) THEN
    RAISE EXCEPTION 'unsupported_email_sent_metadata_key';
  END IF;

  UPDATE public.vtu_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    p_attempt_key,
    true
  )
  WHERE id = p_transaction_id
    AND COALESCE(metadata->>p_attempt_key, 'false') <> 'true'
    AND COALESCE(metadata->>p_sent_key, 'false') <> 'true'
  RETURNING metadata INTO v_metadata;

  RETURN v_metadata;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_vtu_customer_email_metadata_flag(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vtu_customer_email_metadata_flag(uuid, text, text) TO service_role;
