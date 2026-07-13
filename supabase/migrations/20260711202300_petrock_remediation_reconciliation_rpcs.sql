CREATE OR REPLACE FUNCTION public.begin_petrock_eligibility_check(
  p_order_id uuid,
  p_check_kind text,
  p_reference_id uuid,
  p_feedback_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_check_kind NOT IN ('carrier_detection', 'blacklist', 'carrier_status') THEN
    RAISE EXCEPTION 'invalid eligibility check' USING ERRCODE = '22023';
  END IF;
  UPDATE public.petrock_orders
  SET eligibility_next_check = p_check_kind,
      provider_reference_id = p_reference_id,
      feedback_token_hash = p_feedback_token_hash,
      provider_attempt_started_at = now(),
      provider_status = 'eligibility_submitting',
      updated_at = now()
  WHERE id = p_order_id
    AND status = 'eligibility_pending'
    AND provider_order_id IS NULL
    AND provider_attempt_started_at IS NULL;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status, metadata
    ) VALUES (
      p_order_id, 'eligibility_check_started', 'eligibility_pending',
      'eligibility_pending', jsonb_build_object('check', p_check_kind)
    );
  END IF;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_petrock_remediation_submission(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_status text,
  p_next_poll_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_from text;
  v_to text;
BEGIN
  SELECT status INTO v_from FROM public.petrock_orders
  WHERE id = p_order_id FOR UPDATE;
  IF v_from = 'eligibility_pending' THEN v_to := 'eligibility_pending';
  ELSIF v_from = 'submitting' THEN v_to := 'submitted';
  ELSE RETURN false;
  END IF;
  UPDATE public.petrock_orders
  SET status = v_to,
      provider_order_id = p_provider_order_id,
      provider_status = p_provider_status,
      next_poll_at = p_next_poll_at,
      submitted_at = CASE WHEN v_to = 'submitted' THEN now() ELSE submitted_at END,
      updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.petrock_order_events (
    order_id, event_type, from_status, to_status
  ) VALUES (p_order_id, 'provider_submission_recorded', v_from, v_to);
  RETURN true;
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
BEGIN
  UPDATE public.petrock_orders
  SET eligibility_evidence = eligibility_evidence || COALESCE(p_evidence, '{}'::jsonb),
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
    AND status = 'eligibility_pending'
    AND eligibility_next_check = p_check_kind;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status, metadata
    ) VALUES (
      p_order_id, 'eligibility_check_completed', 'eligibility_pending',
      'eligibility_pending', jsonb_build_object('check', p_check_kind)
    );
  END IF;
  RETURN v_changed = 1;
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
BEGIN
  IF p_status NOT IN ('eligible', 'suppressed') THEN
    RAISE EXCEPTION 'invalid eligibility outcome' USING ERRCODE = '22023';
  END IF;
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
      updated_at = now()
  WHERE id = p_order_id AND status = 'eligibility_pending';
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status
    ) VALUES (p_order_id, 'eligibility_resolved', 'eligibility_pending', p_status);
  END IF;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_petrock_remediation_submission(
  p_order_id uuid,
  p_reference_id uuid,
  p_feedback_token_hash text
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
  SET status = 'submitting',
      provider_reference_id = p_reference_id,
      feedback_token_hash = p_feedback_token_hash,
      provider_attempt_started_at = now(),
      provider_status = 'submitting',
      updated_at = now()
  WHERE id = p_order_id AND status = 'paid';
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 1 THEN
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status
    ) VALUES (p_order_id, 'provider_submission_started', 'paid', 'submitting');
  END IF;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_petrock_remediation_submission_unknown(
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
  SET status = 'submission_unknown', provider_status = p_reason,
      next_poll_at = NULL, updated_at = now()
  WHERE id = p_order_id AND status IN ('submitting', 'eligibility_pending');
  GET DIAGNOSTICS v_changed = ROW_COUNT;
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
    WHERE o.status IN ('eligibility_pending', 'paid', 'submitted', 'in_progress', 'submitting')
      AND (
        (o.provider_order_id IS NOT NULL AND COALESCE(o.next_poll_at, now()) <= now())
        OR (o.status = 'paid' AND o.paid_at < now() - interval '2 minutes')
        OR (o.status = 'submitting' AND o.provider_attempt_started_at < now() - interval '2 minutes')
        OR (o.status = 'eligibility_pending' AND o.provider_order_id IS NULL
            AND o.provider_attempt_started_at < now() - interval '2 minutes')
      )
      AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < now())
    ORDER BY COALESCE(o.next_poll_at, o.provider_attempt_started_at, o.paid_at)
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
  IF v_order.status NOT IN ('paid', 'submitting') THEN RETURN false; END IF;

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

CREATE OR REPLACE FUNCTION public.reschedule_petrock_remediation_order(
  p_order_id uuid,
  p_lease_token uuid,
  p_provider_status text,
  p_next_poll_at timestamptz
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
  SET status = CASE WHEN status = 'submitted' THEN 'in_progress' ELSE status END,
      provider_status = p_provider_status,
      next_poll_at = p_next_poll_at,
      reconcile_lease_token = NULL,
      reconcile_lease_until = NULL,
      updated_at = now()
  WHERE id = p_order_id AND reconcile_lease_token = p_lease_token;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_petrock_remediation_order(
  p_order_id uuid,
  p_provider_status text,
  p_success boolean,
  p_customer_message text,
  p_failure_reason text DEFAULT NULL
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
  SELECT * INTO v_order FROM public.petrock_orders o
  WHERE o.id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RETURN false; END IF;
  IF v_order.status IN ('completed', 'failed', 'refunded') THEN RETURN true; END IF;
  IF v_order.status NOT IN ('submitted', 'in_progress', 'submission_unknown') THEN
    RETURN false;
  END IF;

  IF p_success THEN
    UPDATE public.petrock_orders
    SET status = 'completed', provider_status = p_provider_status,
        customer_message = p_customer_message, completed_at = now(),
        identifier_ciphertext = NULL, feedback_token_hash = NULL,
        in_app_notified_at = COALESCE(in_app_notified_at, now()),
        reconcile_lease_token = NULL, reconcile_lease_until = NULL,
        updated_at = now()
    WHERE id = p_order_id;
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status
    ) VALUES (p_order_id, 'order_completed', v_order.status, 'completed');
    RETURN true;
  END IF;

  UPDATE public.petrock_orders
  SET status = CASE WHEN refund_policy = 'refundable'
        THEN 'refund_pending' ELSE 'failed' END,
      provider_status = p_provider_status,
      customer_message = p_customer_message,
      failure_reason = p_failure_reason,
      completed_at = now(),
      in_app_notified_at = CASE WHEN refund_policy = 'refundable'
        THEN in_app_notified_at ELSE COALESCE(in_app_notified_at, now()) END,
      identifier_ciphertext = CASE WHEN refund_policy = 'refundable'
        THEN identifier_ciphertext ELSE NULL END,
      feedback_token_hash = NULL,
      reconcile_lease_token = NULL,
      reconcile_lease_until = NULL,
      updated_at = now()
  WHERE id = p_order_id;
  IF v_order.refund_policy = 'refundable' THEN
    PERFORM public.refund_wallet_for_remediation(p_order_id, p_failure_reason);
  ELSE
    INSERT INTO public.petrock_order_events (
      order_id, event_type, from_status, to_status
    ) VALUES (p_order_id, 'order_failed_no_refund', v_order.status, 'failed');
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_petrock_remediation_notification(
  p_order_id uuid,
  p_channel text,
  p_claim_token uuid,
  p_lease_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_channel NOT IN ('email', 'push')
     OR p_claim_token IS NULL
     OR p_lease_seconds < 30
     OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid remediation notification channel'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.petrock_orders
  SET email_notification_claim_token = CASE WHEN p_channel = 'email'
        THEN p_claim_token ELSE email_notification_claim_token END,
      email_notification_claim_until = CASE WHEN p_channel = 'email'
        THEN now() + make_interval(secs => p_lease_seconds)
        ELSE email_notification_claim_until END,
      push_notification_claim_token = CASE WHEN p_channel = 'push'
        THEN p_claim_token ELSE push_notification_claim_token END,
      push_notification_claim_until = CASE WHEN p_channel = 'push'
        THEN now() + make_interval(secs => p_lease_seconds)
        ELSE push_notification_claim_until END,
      updated_at = now()
  WHERE id = p_order_id
    AND status IN ('completed', 'failed', 'refunded', 'cancelled')
    AND (
      (p_channel = 'email' AND email_notified_at IS NULL AND (
        email_notification_claim_until IS NULL
        OR email_notification_claim_until < now()
      ))
      OR (p_channel = 'push' AND push_notified_at IS NULL AND (
        push_notification_claim_until IS NULL
        OR push_notification_claim_until < now()
      ))
    );
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_petrock_remediation_notification(
  p_order_id uuid,
  p_channel text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_channel NOT IN ('email', 'push') OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid remediation notification channel'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.petrock_orders
  SET email_notified_at = CASE WHEN p_channel = 'email'
        THEN now() ELSE email_notified_at END,
      email_notification_claim_token = CASE WHEN p_channel = 'email'
        THEN NULL ELSE email_notification_claim_token END,
      email_notification_claim_until = CASE WHEN p_channel = 'email'
        THEN NULL ELSE email_notification_claim_until END,
      push_notified_at = CASE WHEN p_channel = 'push'
        THEN now() ELSE push_notified_at END,
      push_notification_claim_token = CASE WHEN p_channel = 'push'
        THEN NULL ELSE push_notification_claim_token END,
      push_notification_claim_until = CASE WHEN p_channel = 'push'
        THEN NULL ELSE push_notification_claim_until END,
      updated_at = now()
  WHERE id = p_order_id
    AND status IN ('completed', 'failed', 'refunded', 'cancelled')
    AND (
      (p_channel = 'email'
        AND email_notified_at IS NULL
        AND email_notification_claim_token = p_claim_token)
      OR (p_channel = 'push'
        AND push_notified_at IS NULL
        AND push_notification_claim_token = p_claim_token)
    );
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_petrock_remediation_notification(
  p_order_id uuid,
  p_channel text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_channel NOT IN ('email', 'push') OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid remediation notification channel'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.petrock_orders
  SET email_notification_claim_token = CASE WHEN p_channel = 'email'
        THEN NULL ELSE email_notification_claim_token END,
      email_notification_claim_until = CASE WHEN p_channel = 'email'
        THEN NULL ELSE email_notification_claim_until END,
      push_notification_claim_token = CASE WHEN p_channel = 'push'
        THEN NULL ELSE push_notification_claim_token END,
      push_notification_claim_until = CASE WHEN p_channel = 'push'
        THEN NULL ELSE push_notification_claim_until END,
      updated_at = now()
  WHERE id = p_order_id
    AND status IN ('completed', 'failed', 'refunded', 'cancelled')
    AND (
      (p_channel = 'email' AND email_notification_claim_token = p_claim_token)
      OR (p_channel = 'push' AND push_notification_claim_token = p_claim_token)
    );
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_petrock_eligibility_check(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_petrock_remediation_submission(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_petrock_eligibility_evidence(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_petrock_eligibility_outcome(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_petrock_remediation_submission(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_petrock_remediation_submission_unknown(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_petrock_remediation_orders(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_petrock_remediation_order(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_petrock_remediation_order(uuid, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_petrock_remediation_before_acceptance(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_petrock_remediation_notification(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_petrock_remediation_notification(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_petrock_remediation_notification(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_petrock_eligibility_check(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_petrock_remediation_submission(uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_petrock_eligibility_evidence(uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_petrock_eligibility_outcome(uuid, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_petrock_remediation_submission(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_petrock_remediation_submission_unknown(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_petrock_remediation_orders(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_petrock_remediation_order(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_petrock_remediation_order(uuid, text, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_petrock_remediation_before_acceptance(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_petrock_remediation_notification(uuid, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_petrock_remediation_notification(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_petrock_remediation_notification(uuid, text, uuid) TO service_role;
