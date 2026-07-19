-- Regression coverage for guest authorization on the Credit Direct client
-- completion RPC. Run after the ordered Credit Direct migrations.
BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000cd21';
  v_order_id uuid := '00000000-0000-4000-8000-00000000cd22';
  v_legacy_order_id uuid := '00000000-0000-4000-8000-00000000cd23';
  v_result jsonb;
  v_notes jsonb;
  v_open_review_count bigint;
  v_review_metadata jsonb;
  v_email_only_rejected boolean := false;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'credit-direct-client-auth@example.com',
    'Credit Direct Client Auth Test',
    'credit-direct-client-auth-test'
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_email,
    customer_name,
    payment_status,
    payment_method,
    total,
    tracking_token,
    notes
  ) VALUES
    (
      v_order_id,
      v_merchant_id,
      'ORD-CD-CLIENT-AUTH',
      'buyer@example.com',
      'Client Auth Test',
      'bnpl_pending',
      'credit_direct',
      240447.87,
      'real-tracking-token',
      jsonb_build_object(
        'creditDirectSessionId', 'session-current',
        'creditDirectSignedAmount', 240447.87
      )::text
    ),
    (
      v_legacy_order_id,
      v_merchant_id,
      'ORD-CD-CLIENT-LEGACY',
      'legacy-buyer@example.com',
      'Legacy Client Auth Test',
      'bnpl_pending',
      'credit_direct',
      125000,
      'legacy-tracking-token',
      jsonb_build_object(
        'creditDirectSessionId', 'legacy-session',
        'creditDirectTransactionId', 'legacy-session',
        'creditDirectSignedAmount', 125000
      )::text
    );

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  BEGIN
    PERFORM public.record_credit_direct_client_completion(
      p_order_id => v_order_id,
      p_checkout_transaction_id => NULL,
      p_session_id => 'session-current',
      p_tracking_token => NULL,
      p_email => 'buyer@example.com'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%unauthorized%' THEN
      RAISE;
    END IF;
    v_email_only_rejected := true;
  END;

  IF NOT v_email_only_rejected THEN
    RAISE EXCEPTION 'email-only Credit Direct completion was authorized';
  END IF;

  v_result := public.record_credit_direct_client_completion(
    p_order_id => v_order_id,
    p_checkout_transaction_id => NULL,
    p_session_id => 'session-current',
    p_tracking_token => 'real-tracking-token',
    p_email => 'buyer@example.com'
  );

  IF v_result->>'status' IS DISTINCT FROM 'pending_confirmation' THEN
    RAISE EXCEPTION 'tracking-token completion returned unexpected result: %', v_result;
  END IF;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_order_id;

  IF v_notes->>'creditDirectClientCompletedSessionId'
       IS DISTINCT FROM 'session-current'
     OR v_notes->>'creditDirectClientCompletionStatus'
       IS DISTINCT FROM 'awaiting_provider_confirmation' THEN
    RAISE EXCEPTION 'tracking-token completion evidence was not recorded: %', v_notes;
  END IF;

  v_result := public.record_credit_direct_client_completion(
    p_order_id => v_legacy_order_id,
    p_checkout_transaction_id => 'legacy-real-transaction',
    p_session_id => 'legacy-session',
    p_tracking_token => 'legacy-tracking-token',
    p_email => 'legacy-buyer@example.com'
  );

  IF v_result->>'status' IS DISTINCT FROM 'pending_confirmation' THEN
    RAISE EXCEPTION 'legacy placeholder completion returned unexpected result: %', v_result;
  END IF;

  v_result := public.record_credit_direct_client_completion(
    p_order_id => v_legacy_order_id,
    p_checkout_transaction_id => 'legacy-real-transaction',
    p_session_id => 'legacy-session',
    p_tracking_token => 'legacy-tracking-token',
    p_email => 'legacy-buyer@example.com'
  );

  IF v_result->>'status' IS DISTINCT FROM 'pending_confirmation' THEN
    RAISE EXCEPTION 'legacy placeholder completion retry returned unexpected result: %', v_result;
  END IF;

  SELECT count(*) INTO v_open_review_count
  FROM public.reconciliation_review
  WHERE issue_type = 'credit_direct_confirmation_missing'
    AND order_id = v_legacy_order_id
    AND resolved_at IS NULL;

  IF v_open_review_count <> 1 THEN
    RAISE EXCEPTION 'legacy completion retry created duplicate reviews: %', v_open_review_count;
  END IF;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_legacy_order_id;

  IF v_notes->>'creditDirectTransactionId'
       IS DISTINCT FROM 'legacy-real-transaction'
     OR v_notes->>'creditDirectClientCompletedTransactionId'
       IS DISTINCT FROM 'legacy-real-transaction'
     OR v_notes->>'creditDirectClientCompletedSessionId'
       IS DISTINCT FROM 'legacy-session' THEN
    RAISE EXCEPTION 'legacy placeholder completion evidence was not recorded: %', v_notes;
  END IF;

  SELECT metadata INTO v_review_metadata
  FROM public.reconciliation_review
  WHERE issue_type = 'credit_direct_confirmation_missing'
    AND order_id = v_legacy_order_id
    AND resolved_at IS NULL;

  IF v_review_metadata->>'source'
       IS DISTINCT FROM 'credit_direct_sdk_on_success' THEN
    RAISE EXCEPTION 'legacy SDK completion review was not filed: %', v_review_metadata;
  END IF;
END;
$$;

ROLLBACK;
