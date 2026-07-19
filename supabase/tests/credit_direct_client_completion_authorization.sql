-- Regression coverage for guest authorization on the Credit Direct client
-- completion RPC. Run after the ordered Credit Direct migrations.
BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000cd21';
  v_order_id uuid := '00000000-0000-4000-8000-00000000cd22';
  v_result jsonb;
  v_notes jsonb;
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
  ) VALUES (
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
END;
$$;

ROLLBACK;
