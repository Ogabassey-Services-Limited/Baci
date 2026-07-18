-- Forward-only authorization correction for environments that already applied
-- 20260718070001_record_credit_direct_client_completion.sql.
CREATE OR REPLACE FUNCTION public.record_credit_direct_client_completion(
  p_order_id uuid,
  p_checkout_transaction_id text DEFAULT NULL::text,
  p_session_id text DEFAULT NULL::text,
  p_tracking_token text DEFAULT NULL::text
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
  v_client_reference text;
  v_completed_session text;
  v_effective_completed_at text;
  v_is_first_completion boolean;
  v_review_metadata jsonb;
  v_completed_at text := to_char(
    clock_timestamp() AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  p_checkout_transaction_id := NULLIF(
    trim(COALESCE(p_checkout_transaction_id, '')),
    ''
  );
  p_session_id := NULLIF(trim(COALESCE(p_session_id, '')), '');
  IF (p_checkout_transaction_id IS NULL AND p_session_id IS NULL)
     OR length(COALESCE(p_checkout_transaction_id, '')) > 200
     OR length(COALESCE(p_session_id, '')) > 200 THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;
  v_client_reference := COALESCE(p_checkout_transaction_id, p_session_id);

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
  v_completed_session := NULLIF(
    v_notes->>'creditDirectClientCompletedSessionId',
    ''
  );
  v_is_first_completion :=
    NULLIF(v_notes->>'creditDirectClientCompletedAt', '') IS NULL
    OR (
      p_session_id IS NOT NULL
      AND p_session_id IS DISTINCT FROM v_completed_session
    );
  v_effective_completed_at := CASE
    WHEN v_is_first_completion THEN v_completed_at
    ELSE NULLIF(v_notes->>'creditDirectClientCompletedAt', '')
  END;

  IF p_checkout_transaction_id IS NOT NULL
     AND v_active_reference IS NOT NULL
     AND v_active_reference <> p_checkout_transaction_id THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  IF p_session_id IS NOT NULL
     AND v_active_session IS NOT NULL
     AND v_active_session <> p_session_id THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  IF jsonb_typeof(v_notes->'creditDirectSupersededReferences') = 'array'
     AND (
       (
         p_checkout_transaction_id IS NOT NULL
         AND (v_notes->'creditDirectSupersededReferences') ? p_checkout_transaction_id
       )
       OR (
         p_session_id IS NOT NULL
         AND (v_notes->'creditDirectSupersededReferences') ? p_session_id
       )
     ) THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  IF v_is_first_completion THEN
    v_notes := v_notes
      - 'creditDirectClientCompletedReference'
      - 'creditDirectClientCompletedTransactionId'
      - 'creditDirectClientCompletedSessionId'
      - 'creditDirectClientCompletedAt'
      - 'creditDirectClientCompletionStatus'
      - 'creditDirectProviderConfirmedAt';
  END IF;

  v_notes := v_notes || jsonb_strip_nulls(
    jsonb_build_object(
      'creditDirectClientCompletedReference', v_client_reference,
      'creditDirectClientCompletedTransactionId', p_checkout_transaction_id,
      'creditDirectClientCompletedSessionId', p_session_id,
      'creditDirectClientCompletedAt', v_effective_completed_at,
      'creditDirectClientCompletionStatus', CASE
        WHEN v_order.payment_status = 'paid' THEN 'provider_confirmed'
        ELSE 'awaiting_provider_confirmation'
      END,
      'creditDirectProviderConfirmedAt', CASE
        WHEN v_order.payment_status = 'paid' THEN COALESCE(
          NULLIF(v_notes->>'creditDirectProviderConfirmedAt', ''),
          NULLIF(v_notes->>'merchantPaidAt', ''),
          v_completed_at
        )
        ELSE NULL
      END
    )
  );

  UPDATE public.orders
  SET notes = v_notes::text,
      updated_at = CASE
        WHEN v_is_first_completion THEN clock_timestamp()
        ELSE updated_at
      END
  WHERE id = v_order.id;

  IF v_order.payment_status = 'paid' THEN
    UPDATE public.reconciliation_review rr
    SET resolved_at = COALESCE(rr.resolved_at, clock_timestamp()),
        resolution_notes = COALESCE(
          rr.resolution_notes,
          'Credit Direct payment was already confirmed before the client callback was recorded.'
        )
    WHERE rr.issue_type = 'credit_direct_confirmation_missing'
      AND rr.order_id = v_order.id
      AND rr.resolved_at IS NULL;

    RETURN jsonb_build_object('status', 'already_confirmed');
  END IF;

  v_review_metadata := jsonb_strip_nulls(
    jsonb_build_object(
      'source', 'credit_direct_sdk_on_success',
      'checkout_transaction_id', p_checkout_transaction_id,
      'session_id', p_session_id,
      'client_completed_at', v_effective_completed_at,
      'payment_status', v_order.payment_status,
      'order_total', v_order.total
    )
  );

  INSERT INTO public.reconciliation_review (
    issue_type,
    merchant_id,
    order_id,
    paystack_ref,
    reason,
    metadata
  ) VALUES (
    'credit_direct_confirmation_missing',
    v_order.merchant_id,
    v_order.id,
    v_client_reference,
    'Credit Direct SDK reported completion but signed provider confirmation is still missing.',
    v_review_metadata
  )
  ON CONFLICT DO NOTHING;

  BEGIN
    UPDATE public.reconciliation_review rr
    SET merchant_id = v_order.merchant_id,
        paystack_ref = v_client_reference,
        reason = 'Credit Direct SDK reported completion but signed provider confirmation is still missing.',
        metadata = (
          CASE
            WHEN v_is_first_completion THEN
              COALESCE(rr.metadata, '{}'::jsonb)
                - 'checkout_transaction_id'
                - 'session_id'
                - 'client_completed_at'
            ELSE COALESCE(rr.metadata, '{}'::jsonb)
          END
        ) || v_review_metadata
    WHERE rr.issue_type = 'credit_direct_confirmation_missing'
      AND rr.order_id = v_order.id
      AND rr.resolved_at IS NULL;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'reference_mismatch';
  END;

  -- A generic ON CONFLICT also protects the provider-reference unique index.
  -- If that reference belongs to another order, no row for this order exists;
  -- reject instead of silently losing the reconciliation trail.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reference_mismatch';
  END IF;

  RETURN jsonb_build_object('status', 'pending_confirmation');
END;
$$;

COMMENT ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text) IS
  'Records untrusted Credit Direct SDK completion evidence and files an ops review without changing payment status.';

REVOKE ALL ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_direct_client_completion(uuid, text, text, text)
  TO anon, authenticated, service_role;
