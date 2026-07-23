-- Keep email as request context for compatibility, but never treat it as a
-- guest credential for this public SECURITY DEFINER completion RPC.
CREATE OR REPLACE FUNCTION public.record_credit_direct_client_completion(
  p_order_id uuid,
  p_checkout_transaction_id text DEFAULT NULL::text,
  p_session_id text DEFAULT NULL::text,
  p_tracking_token text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  v_order public.orders%ROWTYPE;
  v_notes jsonb := '{}'::jsonb;
  v_active_reference text;
  v_active_session text;
  v_completed_transaction text;
  v_completed_session text;
  v_completion_unchanged boolean;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  p_checkout_transaction_id := NULLIF(
    trim(COALESCE(p_checkout_transaction_id, '')),
    ''
  );
  p_session_id := NULLIF(trim(COALESCE(p_session_id, '')), '');
  p_email := NULLIF(trim(COALESCE(p_email, '')), '');
  IF (p_checkout_transaction_id IS NULL AND p_session_id IS NULL)
     OR length(COALESCE(p_checkout_transaction_id, '')) > 200
     OR length(COALESCE(p_session_id, '')) > 200
     OR length(COALESCE(p_email, '')) > 254 THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  SELECT o.*
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF NOT (
      (
        p_tracking_token IS NOT NULL
        AND trim(p_tracking_token) <> ''
        AND p_tracking_token IS NOT DISTINCT FROM v_order.tracking_token
      )
      OR (
        v_user_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = v_order.merchant_id AND m.user_id = v_user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.staff_members sm
            WHERE sm.merchant_id = v_order.merchant_id
              AND sm.user_id = v_user_id
              AND sm.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = v_order.customer_id AND c.user_id = v_user_id
          )
        )
      )
    ) THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  IF v_order.payment_method IS DISTINCT FROM 'credit_direct'
     OR v_order.payment_status IN ('cancelled', 'refunded', 'failed') THEN
    RAISE EXCEPTION 'order_not_payable';
  END IF;

  IF v_order.notes IS NOT NULL AND trim(v_order.notes) <> '' THEN
    BEGIN
      v_notes := v_order.notes::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  v_active_reference := COALESCE(
    NULLIF(v_notes->>'creditDirectTransactionId', ''),
    NULLIF(v_notes->>'credit_directTransactionId', '')
  );
  v_active_session := NULLIF(v_notes->>'creditDirectSessionId', '');

  IF v_request_role <> 'service_role'
     AND (
       v_active_session IS NULL
       OR p_session_id IS NULL
       OR p_session_id IS DISTINCT FROM v_active_session
     ) THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  IF p_checkout_transaction_id IS NOT NULL
     AND v_active_reference IS NOT NULL
     AND p_checkout_transaction_id IS DISTINCT FROM v_active_reference
     AND NOT (
       v_active_reference IS NOT DISTINCT FROM v_active_session
       AND p_session_id IS NOT DISTINCT FROM v_active_session
     ) THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  -- Legacy launchers sometimes persisted the signed session as the popup
  -- reference before the SDK returned its real transaction id. Once the
  -- caller has proved the current signed session and an order credential,
  -- promote that placeholder so the revoked v1 worker can record the SDK
  -- completion under the real reference. A superseded reference is still
  -- rejected by the v1 worker and rolls this update back atomically.
  IF p_checkout_transaction_id IS NOT NULL
     AND p_checkout_transaction_id IS DISTINCT FROM v_active_reference
     AND v_active_reference IS NOT DISTINCT FROM v_active_session
     AND p_session_id IS NOT DISTINCT FROM v_active_session THEN
    v_notes :=
      (v_notes - 'creditDirectTransactionId' - 'credit_directTransactionId') ||
      jsonb_build_object(
        'creditDirectTransactionId',
        p_checkout_transaction_id
      );

    UPDATE public.orders
    SET notes = v_notes::text
    WHERE id = v_order.id;
  END IF;

  v_completed_transaction := NULLIF(
    v_notes->>'creditDirectClientCompletedTransactionId',
    ''
  );
  v_completed_session := NULLIF(
    v_notes->>'creditDirectClientCompletedSessionId',
    ''
  );
  v_completion_unchanged :=
    NULLIF(v_notes->>'creditDirectClientCompletedAt', '') IS NOT NULL
    AND p_session_id IS NOT DISTINCT FROM v_completed_session
    AND (
      p_checkout_transaction_id IS NULL
      OR p_checkout_transaction_id IS NOT DISTINCT FROM v_completed_transaction
    )
    AND NOT (
      v_completed_transaction IS NULL
      AND p_checkout_transaction_id IS NOT NULL
    );

  IF v_completion_unchanged AND v_order.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('status', 'pending_confirmation');
  END IF;

  RETURN public.record_credit_direct_client_completion_v1(
    p_order_id,
    p_checkout_transaction_id,
    p_session_id,
    p_tracking_token
  );
END;
$$;

COMMENT ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text, text) IS
  'Records untrusted Credit Direct SDK completion only for the current signed session and a real guest or authenticated credential.';

REVOKE ALL ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text, text)
  TO anon, authenticated, service_role;
