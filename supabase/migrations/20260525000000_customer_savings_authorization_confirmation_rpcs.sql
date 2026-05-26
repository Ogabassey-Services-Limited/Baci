-- Customer-scoped creation and confirmation for Paystack savings authorization.
-- Direct table access cannot be used for customer requests because transactions
-- remain merchant/backend-owned; these functions enforce the customer scope.

CREATE OR REPLACE FUNCTION public.create_customer_savings_authorization_transaction(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_reference text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer_email text;
  v_customer_first_name text;
  v_customer_last_name text;
  v_merchant_slug text;
  v_transaction_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'authorization_amount_must_be_positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_reference IS NULL OR p_reference !~ '^SAV-AUTH-[A-Z0-9_-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid_savings_authorization_reference'
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

  SELECT c.email, c.first_name, c.last_name
  INTO v_customer_email, v_customer_first_name, v_customer_last_name
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.merchant_id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_or_merchant_not_found_for_authorization'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.slug
  INTO v_merchant_slug
  FROM public.merchants m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_or_merchant_not_found_for_authorization'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (
    amount,
    currency,
    description,
    gateway,
    gateway_reference,
    merchant_amount,
    merchant_id,
    metadata,
    order_id,
    platform_fee,
    status,
    transaction_type
  )
  VALUES (
    p_amount,
    'NGN',
    'Savings auto-debit card authorization setup',
    'paystack',
    p_reference,
    0,
    p_merchant_id,
    jsonb_build_object(
      'customer_email', v_customer_email,
      'customer_id', p_customer_id,
      'customer_name', COALESCE(
        NULLIF(trim(concat_ws(' ', v_customer_first_name, v_customer_last_name)), ''),
        v_customer_email
      ),
      'merchant_slug', v_merchant_slug,
      'purpose', 'device_savings_auto_debit',
      'savings_accounting_policy', 'credit_wallet',
      'transaction_type', 'savings_authorization'
    ),
    NULL,
    0,
    'pending',
    'payment'
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_customer_savings_authorization(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_reference text
) RETURNS TABLE(
  status text,
  saved_payment_method_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_reference IS NULL OR p_reference !~ '^SAV-AUTH-[A-Z0-9_-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid_savings_authorization_reference'
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

  RETURN QUERY
  SELECT
    CASE
      WHEN t.status = 'completed'
        AND pm.id IS NOT NULL
        AND wt.id IS NOT NULL
      THEN 'successful'::text
      ELSE 'processing'::text
    END AS status,
    CASE
      WHEN t.status = 'completed' AND wt.id IS NOT NULL THEN pm.id
      ELSE NULL::uuid
    END AS saved_payment_method_id
  FROM public.transactions t
  LEFT JOIN public.customer_saved_payment_methods pm
    ON pm.merchant_id = t.merchant_id
    AND pm.customer_id = p_customer_id
    AND pm.provider = 'paystack'
    AND pm.authorization_signature =
      t.gateway_response->'authorization'->>'signature'
    AND pm.is_active = true
    AND pm.reusable = true
  LEFT JOIN public.customer_wallet_transactions wt
    ON wt.merchant_id = t.merchant_id
    AND wt.customer_id = p_customer_id
    AND wt.source_type = 'wallet_topup'
    AND wt.source_id = t.id
    AND wt.type = 'credit'
    AND wt.status = 'completed'
  WHERE t.merchant_id = p_merchant_id
    AND t.gateway = 'paystack'
    AND t.gateway_reference = p_reference
    AND t.metadata->>'transaction_type' = 'savings_authorization'
    AND t.metadata->>'customer_id' = p_customer_id::text
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_customer_savings_authorization_transaction(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_reference text,
  p_failure_message text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_reference IS NULL OR p_reference !~ '^SAV-AUTH-[A-Z0-9_-]{1,100}$' THEN
    RAISE EXCEPTION 'invalid_savings_authorization_reference'
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

  UPDATE public.transactions t
  SET
    status = 'failed',
    gateway_response = jsonb_build_object(
      'error',
      left(COALESCE(NULLIF(p_failure_message, ''), 'Paystack initialization failed'), 500)
    ),
    updated_at = now()
  WHERE t.merchant_id = p_merchant_id
    AND t.gateway = 'paystack'
    AND t.gateway_reference = p_reference
    AND t.status = 'pending'
    AND t.metadata->>'transaction_type' = 'savings_authorization'
    AND t.metadata->>'customer_id' = p_customer_id::text;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_savings_feature_settings(
  p_customer_id uuid,
  p_merchant_id uuid
) RETURNS TABLE(
  customer_device_savings_enabled boolean,
  customer_device_savings_auto_debit_enabled boolean,
  paystack_enabled boolean
)
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'customer_or_merchant_not_found_for_savings_settings'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    settings.customer_device_savings_enabled,
    settings.customer_device_savings_auto_debit_enabled,
    settings.paystack_enabled
  FROM public.merchants merchant
  LEFT JOIN public.merchant_feature_settings settings
    ON settings.merchant_id = merchant.id
  WHERE merchant.id = p_merchant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_wallet_dva_enabled(
  p_customer_id uuid,
  p_merchant_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_enabled boolean;
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
      RAISE EXCEPTION 'not_authorized_for_customer_wallet_dva'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'customer_or_merchant_not_found_for_wallet_dva'
      USING ERRCODE = '42501';
  END IF;

  SELECT settings.wallet_paystack_dva_enabled
  INTO v_enabled
  FROM public.merchants merchant
  LEFT JOIN public.merchant_feature_settings settings
    ON settings.merchant_id = merchant.id
  WHERE merchant.id = p_merchant_id;

  RETURN COALESCE(v_enabled, false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_savings_authorization_transaction(uuid, uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_customer_savings_authorization(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fail_customer_savings_authorization_transaction(uuid, uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_customer_savings_feature_settings(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_customer_wallet_dva_enabled(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_customer_savings_authorization_transaction(uuid, uuid, numeric, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_customer_savings_authorization(uuid, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_customer_savings_authorization_transaction(uuid, uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_savings_feature_settings(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_wallet_dva_enabled(uuid, uuid)
  TO authenticated, service_role;
