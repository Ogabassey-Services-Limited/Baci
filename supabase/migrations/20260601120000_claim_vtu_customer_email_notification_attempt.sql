CREATE OR REPLACE FUNCTION public.claim_vtu_customer_email_notification_attempt(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_metadata jsonb;
BEGIN
  UPDATE public.vtu_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'customerEmailNotificationAttempted',
    true
  )
  WHERE id = p_transaction_id
    AND COALESCE(metadata->>'customerEmailNotificationAttempted', 'false') <> 'true'
    AND COALESCE(metadata->>'customerEmailNotificationSent', 'false') <> 'true'
  RETURNING metadata INTO v_metadata;

  RETURN v_metadata;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_vtu_customer_email_notification_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vtu_customer_email_notification_attempt(uuid) TO service_role;
