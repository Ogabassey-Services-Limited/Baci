CREATE OR REPLACE FUNCTION public.clear_vtu_customer_email_notification_attempt(
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
  v_allowed_attempt_keys constant text[] := ARRAY[
    'customerReceiptEmailNotificationAttempted',
    'customerTokenEmailNotificationAttempted'
  ];
  v_allowed_sent_keys constant text[] := ARRAY[
    'customerReceiptEmailNotificationSent',
    'customerTokenEmailNotificationSent'
  ];
  v_metadata jsonb;
BEGIN
  IF NOT (
    p_attempt_key = ANY(v_allowed_attempt_keys)
    AND p_sent_key = ANY(v_allowed_sent_keys)
  ) THEN
    RAISE EXCEPTION 'Unsupported VTU customer email metadata key'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vtu_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    p_attempt_key,
    false
  )
  WHERE id = p_transaction_id
    AND COALESCE(metadata ->> p_sent_key, 'false') <> 'true'
    AND COALESCE(metadata ->> p_attempt_key, 'false') = 'true'
  RETURNING metadata INTO v_metadata;

  RETURN v_metadata;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_vtu_customer_email_notification_attempt(uuid, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.clear_vtu_customer_email_notification_attempt(uuid, text, text)
TO service_role;
