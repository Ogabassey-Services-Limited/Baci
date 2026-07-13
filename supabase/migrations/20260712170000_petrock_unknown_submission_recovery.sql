CREATE OR REPLACE FUNCTION public.reset_petrock_remediation_quote(
  p_order_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  UPDATE public.petrock_orders
  SET status = 'eligible',
      remediation_product_id = NULL,
      payment_currency = NULL,
      amount_ngn = NULL,
      amount_usdt = NULL,
      cost_usd = NULL,
      fx_rate_used = NULL,
      refund_policy = NULL,
      success_rate = NULL,
      turnaround = NULL,
      provider_status = p_reason,
      customer_message = 'The previous quote expired. Choose a current unlock offer.',
      updated_at = now()
  WHERE id = p_order_id AND status = 'payment_pending';
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status, metadata
    ) VALUES (
      p_order_id, 'quote_invalidated', 'payment_pending', 'eligible',
      jsonb_build_object('reason', p_reason)
    );
  END IF;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_petrock_remediation_orders(
  p_lease_token uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 90
)
RETURNS SETOF public.petrock_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_lease_token IS NULL
     OR p_limit < 1
     OR p_limit > 100
     OR p_lease_seconds < 15
     OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid remediation reconciliation lease'
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id FROM public.petrock_orders o
    WHERE o.status IN (
      'eligibility_pending', 'paid', 'submitted', 'in_progress',
      'submitting', 'submission_unknown'
    )
      AND (
        (o.provider_order_id IS NOT NULL AND COALESCE(o.next_poll_at, now()) <= now())
        OR (o.status = 'paid' AND o.paid_at < now() - interval '2 minutes')
        OR (o.status = 'submitting' AND o.provider_attempt_started_at < now() - interval '2 minutes')
        OR (o.status = 'eligibility_pending' AND o.provider_order_id IS NULL
            AND o.provider_attempt_started_at < now() - interval '2 minutes')
        OR (o.status = 'submission_unknown' AND o.provider_order_id IS NULL
            AND o.updated_at < now() - interval '2 minutes')
      )
      AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < now())
    ORDER BY COALESCE(
      o.next_poll_at,
      o.provider_attempt_started_at,
      o.paid_at,
      o.updated_at
    )
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.petrock_orders o
  SET reconcile_lease_token = p_lease_token,
      reconcile_lease_until = now() + make_interval(secs => p_lease_seconds),
      reconcile_attempts = o.reconcile_attempts + 1,
      updated_at = now()
  FROM candidates c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_petrock_remediation_before_acceptance(
  p_order_id uuid,
  p_reason text,
  p_customer_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order public.petrock_orders%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order
  FROM public.petrock_orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN RETURN false; END IF;
  IF v_order.status = 'refunded' THEN RETURN true; END IF;
  IF v_order.status NOT IN ('paid', 'submitting', 'submission_unknown') THEN
    RETURN false;
  END IF;

  UPDATE public.petrock_orders
  SET status = 'refund_pending',
      provider_status = p_reason,
      customer_message = p_customer_message,
      failure_reason = p_reason,
      reconcile_lease_token = NULL,
      reconcile_lease_until = NULL,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.petrock_order_events (
    order_id, event_type, from_status, to_status, metadata
  ) VALUES (
    p_order_id, 'provider_not_accepted', v_order.status, 'refund_pending',
    jsonb_build_object('reason', p_reason)
  );

  PERFORM public.refund_wallet_for_remediation(p_order_id, p_reason);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_petrock_eligibility_outcome(
  p_order_id uuid,
  p_status text,
  p_carrier text,
  p_device_model text,
  p_status_segment text,
  p_customer_message text,
  p_failure_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
  v_from_status text;
BEGIN
  IF p_status NOT IN ('eligible', 'suppressed') THEN
    RAISE EXCEPTION 'invalid eligibility outcome' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_from_status
  FROM public.petrock_orders
  WHERE id = p_order_id AND status IN ('eligibility_pending', 'submission_unknown')
  FOR UPDATE;
  IF v_from_status IS NULL THEN RETURN false; END IF;

  UPDATE public.petrock_orders
  SET status = p_status,
      carrier = p_carrier,
      device_model = p_device_model,
      status_segment = p_status_segment,
      customer_message = p_customer_message,
      failure_reason = p_failure_reason,
      identifier_ciphertext = CASE WHEN p_status = 'suppressed'
        THEN NULL ELSE identifier_ciphertext END,
      feedback_token_hash = NULL,
      provider_order_id = NULL,
      provider_reference_id = NULL,
      eligibility_next_check = NULL,
      reconcile_lease_token = NULL,
      reconcile_lease_until = NULL,
      updated_at = now()
  WHERE id = p_order_id AND status IN ('eligibility_pending', 'submission_unknown');
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status
    ) VALUES (p_order_id, 'eligibility_resolved', v_from_status, p_status);
  END IF;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_petrock_eligibility_evidence(
  p_order_id uuid,
  p_check_kind text,
  p_evidence jsonb,
  p_provider_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
  v_from_status text;
BEGIN
  SELECT status INTO v_from_status
  FROM public.petrock_orders
  WHERE id = p_order_id
    AND status IN ('eligibility_pending', 'submission_unknown')
    AND eligibility_next_check = p_check_kind
  FOR UPDATE;
  IF v_from_status IS NULL THEN RETURN false; END IF;

  UPDATE public.petrock_orders
  SET status = 'eligibility_pending',
      eligibility_evidence = eligibility_evidence || COALESCE(p_evidence, '{}'::jsonb),
      eligibility_checks_completed = array_append(
        eligibility_checks_completed,
        p_check_kind
      ),
      eligibility_next_check = NULL,
      provider_order_id = NULL,
      provider_reference_id = NULL,
      feedback_token_hash = NULL,
      provider_attempt_started_at = NULL,
      provider_status = p_provider_status,
      next_poll_at = NULL,
      reconcile_lease_token = NULL,
      reconcile_lease_until = NULL,
      updated_at = now()
  WHERE id = p_order_id
    AND status IN ('eligibility_pending', 'submission_unknown')
    AND eligibility_next_check = p_check_kind;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status, metadata
    ) VALUES (
      p_order_id, 'eligibility_check_completed', v_from_status,
      'eligibility_pending', jsonb_build_object('check', p_check_kind)
    );
  END IF;
  RETURN v_changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_petrock_remediation_quote(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_petrock_remediation_before_acceptance(
  uuid, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_petrock_eligibility_outcome(
  uuid, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_petrock_eligibility_evidence(
  uuid, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_petrock_remediation_quote(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_petrock_remediation_before_acceptance(
  uuid, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_petrock_eligibility_outcome(
  uuid, text, text, text, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_petrock_eligibility_evidence(
  uuid, text, jsonb, text
) TO service_role;
