-- Security-definer RPCs for non-withdrawable customer device savings.

CREATE OR REPLACE FUNCTION public.allocate_customer_savings_contribution(
  p_goal_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_description text DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  goal_current_amount numeric,
  wallet_balance numeric,
  contribution_id uuid,
  wallet_transaction_id uuid,
  goal_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_wallet_balance numeric;
  v_new_wallet_balance numeric;
  v_contribution_id uuid;
  v_wallet_transaction_id uuid;
  v_existing_contribution record;
  v_goal record;
  v_new_goal_amount numeric;
  v_new_goal_status text;
  v_request_fingerprint jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_goal_id IS NULL THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution p_goal_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution p_customer_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution p_merchant_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution p_idempotency_key is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_type NOT IN ('wallet', 'paystack_authorization') THEN
    RAISE EXCEPTION 'unsupported_savings_contribution_source_type'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_type = 'paystack_authorization' AND p_source_id IS NULL THEN
    RAISE EXCEPTION 'paystack_authorization_source_id_required'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'customer_not_found_for_merchant'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer_savings_contribution:' || p_idempotency_key,
      0
    )
  );

  v_request_fingerprint := jsonb_build_object(
    'goalId', p_goal_id,
    'customerId', p_customer_id,
    'merchantId', p_merchant_id,
    'amount', p_amount,
    'sourceType', p_source_type,
    'sourceId', p_source_id
  );

  SELECT c.*
  INTO v_existing_contribution
  FROM public.customer_savings_contributions c
  WHERE c.merchant_id = p_merchant_id
    AND c.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_existing_contribution.id IS NOT NULL THEN
    IF v_existing_contribution.status = 'completed' THEN
      IF v_existing_contribution.metadata->'request_fingerprint' IS DISTINCT FROM v_request_fingerprint THEN
        RAISE EXCEPTION 'duplicate_savings_contribution_idempotency_key'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT g.current_amount, g.status, COALESCE(w.available_balance, 0)
      INTO v_new_goal_amount, v_new_goal_status, v_new_wallet_balance
      FROM public.customer_savings_goals g
      LEFT JOIN public.customer_wallets w
        ON w.customer_id = g.customer_id
       AND w.merchant_id = g.merchant_id
      WHERE g.id = v_existing_contribution.goal_id;

      RETURN QUERY
      SELECT
        true,
        v_new_goal_amount,
        v_new_wallet_balance,
        v_existing_contribution.id,
        v_existing_contribution.wallet_transaction_id,
        v_new_goal_status;
      RETURN;
    END IF;

    IF v_existing_contribution.status IN ('pending', 'processing')
      AND v_existing_contribution.source_type = 'paystack_authorization'
      AND p_source_type = 'paystack_authorization'
      AND v_existing_contribution.transaction_id = p_source_id
      AND v_existing_contribution.metadata->'request_fingerprint' = v_request_fingerprint
    THEN
      v_contribution_id := v_existing_contribution.id;
    ELSE
      RAISE EXCEPTION 'duplicate_savings_contribution_idempotency_key'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_contribution_id := gen_random_uuid();
  END IF;

  SELECT g.*
  INTO v_goal
  FROM public.customer_savings_goals g
  WHERE g.id = p_goal_id
    AND g.customer_id = p_customer_id
    AND g.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_goal.status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'savings_goal_not_allocatable'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > (v_goal.target_amount - v_goal.current_amount) THEN
    RAISE EXCEPTION 'savings_contribution_exceeds_remaining_target'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT w.id, w.available_balance
  INTO v_wallet_id, v_current_wallet_balance
  FROM public.customer_wallets w
  WHERE w.customer_id = p_customer_id
    AND w.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR COALESCE(v_current_wallet_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_wallet_balance'
      USING ERRCODE = 'P0001';
  END IF;

  v_new_wallet_balance := v_current_wallet_balance - p_amount;

  UPDATE public.customer_wallets
  SET
    available_balance = v_new_wallet_balance,
    updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    status,
    description,
    metadata
  )
  VALUES (
    v_wallet_id,
    p_customer_id,
    p_merchant_id,
    'redemption',
    p_amount,
    v_new_wallet_balance,
    'device_savings_contribution',
    v_contribution_id,
    'completed',
    COALESCE(p_description, 'Device savings contribution'),
    jsonb_build_object(
      'goal_id', p_goal_id,
      'idempotency_key', p_idempotency_key,
      'source_type', p_source_type
    )
  )
  RETURNING id INTO v_wallet_transaction_id;

  IF v_existing_contribution.id IS NULL THEN
    INSERT INTO public.customer_savings_contributions (
      id,
      goal_id,
      merchant_id,
      customer_id,
      wallet_transaction_id,
      transaction_id,
      amount,
      source_type,
      status,
      processed_at,
      idempotency_key,
      metadata
    )
    VALUES (
      v_contribution_id,
      p_goal_id,
      p_merchant_id,
      p_customer_id,
      v_wallet_transaction_id,
      CASE WHEN p_source_type = 'paystack_authorization' THEN p_source_id ELSE NULL END,
      p_amount,
      p_source_type,
      'completed',
      now(),
      p_idempotency_key,
      jsonb_build_object(
        'description', p_description,
        'request_fingerprint', v_request_fingerprint
      )
    );
  ELSE
    UPDATE public.customer_savings_contributions
    SET
      wallet_transaction_id = v_wallet_transaction_id,
      amount = p_amount,
      status = 'completed',
      processed_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'description', p_description,
        'request_fingerprint', v_request_fingerprint
      ),
      updated_at = now()
    WHERE id = v_contribution_id;
  END IF;

  v_new_goal_amount := v_goal.current_amount + p_amount;
  v_new_goal_status := CASE
    WHEN v_new_goal_amount >= v_goal.target_amount THEN 'completed'
    ELSE v_goal.status
  END;

  UPDATE public.customer_savings_goals
  SET
    current_amount = v_new_goal_amount,
    status = v_new_goal_status,
    completed_at = CASE
      WHEN v_new_goal_status = 'completed' AND completed_at IS NULL THEN now()
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    metadata
  )
  VALUES (
    p_goal_id,
    p_merchant_id,
    p_customer_id,
    'contribution_completed',
    'customer',
    jsonb_build_object(
      'amount', p_amount,
      'contribution_id', v_contribution_id,
      'wallet_transaction_id', v_wallet_transaction_id,
      'idempotency_key', p_idempotency_key
    )
  );

  IF v_new_goal_status = 'completed' AND v_goal.status <> 'completed' THEN
    INSERT INTO public.customer_savings_events (
      goal_id,
      merchant_id,
      customer_id,
      event_type,
      actor_type,
      metadata
    )
    VALUES (
      p_goal_id,
      p_merchant_id,
      p_customer_id,
      'goal_completed',
      'system',
      jsonb_build_object('current_amount', v_new_goal_amount)
    );
  END IF;

  RETURN QUERY
  SELECT
    true,
    v_new_goal_amount,
    v_new_wallet_balance,
    v_contribution_id,
    v_wallet_transaction_id,
    v_new_goal_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_savings_goal(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_title text,
  p_product_snapshot jsonb,
  p_target_amount numeric,
  p_initial_contribution_amount numeric,
  p_contribution_amount numeric,
  p_contribution_frequency text,
  p_preferred_debit_time time,
  p_start_date date,
  p_maturity_date date,
  p_source_mode text,
  p_saved_payment_method_id uuid,
  p_terms_accepted_at timestamptz,
  p_non_withdrawable_accepted_at timestamptz,
  p_auto_debit_authorized_at timestamptz,
  p_early_end_fee_accepted_at timestamptz,
  p_break_fee_percent numeric,
  p_metadata jsonb,
  p_initial_contribution_idempotency_key text
) RETURNS TABLE(
  success boolean,
  goal_id uuid,
  current_amount numeric,
  wallet_balance numeric,
  contribution_id uuid,
  goal_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_goal_id uuid;
  v_goal_status text := 'active';
  v_wallet_balance numeric := 0;
  v_initial_contribution_id uuid;
  v_allocation record;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'create_customer_savings_goal p_customer_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'create_customer_savings_goal p_merchant_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'create_customer_savings_goal p_product_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_target_amount IS NULL OR p_target_amount <= 0 THEN
    RAISE EXCEPTION 'target_amount_must_be_positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_contribution_amount IS NULL OR p_contribution_amount <= 0 THEN
    RAISE EXCEPTION 'contribution_amount_must_be_positive'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_initial_contribution_amount, 0) < 0
    OR COALESCE(p_initial_contribution_amount, 0) > p_target_amount
  THEN
    RAISE EXCEPTION 'invalid_initial_contribution_amount'
      USING ERRCODE = '22023';
  END IF;

  IF p_contribution_frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'invalid_contribution_frequency'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_mode NOT IN ('manual', 'auto_debit') THEN
    RAISE EXCEPTION 'invalid_savings_source_mode'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_date IS NULL
    OR p_maturity_date IS NULL
    OR p_maturity_date < p_start_date
  THEN
    RAISE EXCEPTION 'invalid_savings_dates'
      USING ERRCODE = '22023';
  END IF;

  IF p_terms_accepted_at IS NULL OR p_non_withdrawable_accepted_at IS NULL THEN
    RAISE EXCEPTION 'required_savings_consents_missing'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'customer_not_found_for_merchant'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.merchant_id = p_merchant_id
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'product_not_available_for_savings'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_variant_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_variants v
      WHERE v.id = p_variant_id
        AND v.product_id = p_product_id
        AND v.merchant_id = p_merchant_id
    )
  THEN
    RAISE EXCEPTION 'variant_not_available_for_savings'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_source_mode = 'auto_debit' THEN
    IF p_saved_payment_method_id IS NULL OR p_auto_debit_authorized_at IS NULL THEN
      RAISE EXCEPTION 'auto_debit_payment_method_and_consent_required'
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customer_saved_payment_methods pm
      WHERE pm.id = p_saved_payment_method_id
        AND pm.customer_id = p_customer_id
        AND pm.merchant_id = p_merchant_id
        AND pm.provider = 'paystack'
        AND pm.is_active = true
        AND pm.reusable = true
    ) THEN
      RAISE EXCEPTION 'saved_payment_method_not_available_for_savings'
        USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(p_initial_contribution_amount, 0) > 0 THEN
      v_goal_status := 'paused';
    END IF;
  END IF;

  INSERT INTO public.customer_savings_goals (
    merchant_id,
    customer_id,
    product_id,
    variant_id,
    title,
    product_snapshot,
    target_amount,
    current_amount,
    initial_contribution_amount,
    contribution_amount,
    contribution_frequency,
    preferred_debit_time,
    start_date,
    maturity_date,
    source_mode,
    saved_payment_method_id,
    status,
    break_fee_percent,
    terms_accepted_at,
    non_withdrawable_accepted_at,
    auto_debit_authorized_at,
    early_end_fee_accepted_at,
    metadata
  )
  VALUES (
    p_merchant_id,
    p_customer_id,
    p_product_id,
    p_variant_id,
    p_title,
    COALESCE(p_product_snapshot, '{}'::jsonb),
    p_target_amount,
    0,
    COALESCE(p_initial_contribution_amount, 0),
    p_contribution_amount,
    p_contribution_frequency,
    p_preferred_debit_time,
    p_start_date,
    p_maturity_date,
    p_source_mode,
    p_saved_payment_method_id,
    v_goal_status,
    COALESCE(p_break_fee_percent, 0),
    p_terms_accepted_at,
    p_non_withdrawable_accepted_at,
    p_auto_debit_authorized_at,
    p_early_end_fee_accepted_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_goal_id;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    metadata
  )
  VALUES (
    v_goal_id,
    p_merchant_id,
    p_customer_id,
    'goal_created',
    'customer',
    jsonb_build_object(
      'source_mode', p_source_mode,
      'target_amount', p_target_amount,
      'initial_contribution_amount', COALESCE(p_initial_contribution_amount, 0)
    )
  );

  IF p_source_mode = 'manual' AND COALESCE(p_initial_contribution_amount, 0) > 0 THEN
    SELECT *
    INTO v_allocation
    FROM public.allocate_customer_savings_contribution(
      v_goal_id,
      p_customer_id,
      p_merchant_id,
      p_initial_contribution_amount,
      'wallet',
      NULL,
      COALESCE(NULLIF(p_initial_contribution_idempotency_key, ''), 'savings:' || v_goal_id::text || ':initial'),
      'Initial device savings contribution'
    );

    v_wallet_balance := v_allocation.wallet_balance;
    v_initial_contribution_id := v_allocation.contribution_id;
    v_goal_status := v_allocation.goal_status;
  ELSIF p_source_mode = 'auto_debit' AND COALESCE(p_initial_contribution_amount, 0) > 0 THEN
    INSERT INTO public.customer_savings_events (
      goal_id,
      merchant_id,
      customer_id,
      event_type,
      actor_type,
      metadata
    )
    VALUES (
      v_goal_id,
      p_merchant_id,
      p_customer_id,
      'initial_auto_debit_pending',
      'system',
      jsonb_build_object(
        'amount', p_initial_contribution_amount,
        'idempotency_key', COALESCE(NULLIF(p_initial_contribution_idempotency_key, ''), 'savings:' || v_goal_id::text || ':initial')
      )
    );
  ELSE
    SELECT COALESCE(w.available_balance, 0)
    INTO v_wallet_balance
    FROM public.customer_wallets w
    WHERE w.customer_id = p_customer_id
      AND w.merchant_id = p_merchant_id;
  END IF;

  RETURN QUERY
  SELECT
    true,
    v_goal_id,
    COALESCE(v_allocation.goal_current_amount, 0::numeric),
    COALESCE(v_wallet_balance, 0::numeric),
    v_initial_contribution_id,
    v_goal_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_customer_savings_goal_future_debits(
  p_goal_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_actor_id uuid DEFAULT NULL
) RETURNS TABLE(success boolean, goal_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_goal record;
  v_goal_status text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT *
  INTO v_goal
  FROM public.customer_savings_goals
  WHERE id = p_goal_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_goal.status IN ('spent', 'cancelled') THEN
    RAISE EXCEPTION 'savings_goal_not_cancellable'
      USING ERRCODE = 'P0001';
  END IF;

  v_goal_status := CASE
    WHEN v_goal.current_amount > 0 THEN 'paused'
    ELSE 'cancelled'
  END;

  UPDATE public.customer_savings_goals
  SET
    status = v_goal_status,
    future_debits_cancelled_at = now(),
    cancelled_at = CASE WHEN v_goal_status = 'cancelled' THEN now() ELSE cancelled_at END,
    updated_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  )
  VALUES (
    p_goal_id,
    p_merchant_id,
    p_customer_id,
    'future_debits_cancelled',
    'customer',
    p_actor_id,
    jsonb_build_object('status', v_goal_status)
  );

  RETURN QUERY SELECT true, v_goal_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_customer_savings_goal(
  p_goal_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_actor_id uuid DEFAULT NULL
) RETURNS TABLE(success boolean, goal_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.customer_savings_goals
  SET status = 'paused', updated_at = now()
  WHERE id = p_goal_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'savings_goal_not_paused'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    actor_id
  )
  VALUES (p_goal_id, p_merchant_id, p_customer_id, 'goal_paused', 'customer', p_actor_id);

  RETURN QUERY SELECT true, 'paused'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_customer_savings_goal(
  p_goal_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_actor_id uuid DEFAULT NULL
) RETURNS TABLE(success boolean, goal_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.customer_savings_goals
  SET
    status = CASE WHEN current_amount >= target_amount THEN 'completed' ELSE 'active' END,
    future_debits_cancelled_at = NULL,
    updated_at = now()
  WHERE id = p_goal_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
    AND status = 'paused';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'savings_goal_not_resumed'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    actor_id
  )
  VALUES (p_goal_id, p_merchant_id, p_customer_id, 'goal_resumed', 'customer', p_actor_id);

  RETURN QUERY
  SELECT true, g.status
  FROM public.customer_savings_goals g
  WHERE g.id = p_goal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_savings_goal(
  uuid, uuid, uuid, uuid, text, jsonb, numeric, numeric, numeric, text, time,
  date, date, text, uuid, timestamptz, timestamptz, timestamptz, timestamptz,
  numeric, jsonb, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.allocate_customer_savings_contribution(uuid, uuid, uuid, numeric, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_customer_savings_goal_future_debits(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pause_customer_savings_goal(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_customer_savings_goal(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_customer_savings_goal(
  uuid, uuid, uuid, uuid, text, jsonb, numeric, numeric, numeric, text, time,
  date, date, text, uuid, timestamptz, timestamptz, timestamptz, timestamptz,
  numeric, jsonb, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_customer_savings_contribution(uuid, uuid, uuid, numeric, text, uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_customer_savings_goal_future_debits(uuid, uuid, uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pause_customer_savings_goal(uuid, uuid, uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resume_customer_savings_goal(uuid, uuid, uuid, uuid)
  TO authenticated, service_role;
