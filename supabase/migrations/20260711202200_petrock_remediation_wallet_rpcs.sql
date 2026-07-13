CREATE OR REPLACE FUNCTION public.prepare_petrock_remediation_order(
  p_order_id uuid,
  p_product_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_payment_currency text,
  p_fx_rate numeric
)
RETURNS SETOF public.petrock_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order public.petrock_orders%ROWTYPE;
  v_product public.petrock_remediation_products%ROWTYPE;
BEGIN
  IF p_payment_currency NOT IN ('NGN', 'USDT') OR p_fx_rate <= 0 THEN
    RAISE EXCEPTION 'invalid remediation payment quote' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_order FROM public.petrock_orders o
  WHERE o.id = p_order_id AND o.customer_id = p_customer_id
    AND o.merchant_id = p_merchant_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'remediation order not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status <> 'eligible' THEN
    RAISE EXCEPTION 'remediation order is not eligible' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_product FROM public.petrock_remediation_products p
  WHERE p.id = p_product_id AND p.is_active AND NOT p.manual_disabled
    AND p.review_status = 'approved' AND p.fixture_verified
    AND p.excluded_reason IS NULL AND p.launch_carrier
  FOR UPDATE;
  IF v_product.id IS NULL OR v_product.carrier <> v_order.carrier
     OR v_product.status_segment <> v_order.status_segment THEN
    RAISE EXCEPTION 'remediation product is not eligible' USING ERRCODE = '22023';
  END IF;
  IF (p_payment_currency = 'NGN'
      AND v_product.price_ngn < v_product.cost_usd * p_fx_rate)
     OR (p_payment_currency = 'USDT'
      AND v_product.price_usdt < v_product.cost_usd) THEN
    RAISE EXCEPTION 'remediation product price is below provider cost'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.petrock_orders
  SET remediation_product_id = v_product.id,
      status = 'payment_pending',
      payment_currency = p_payment_currency,
      amount_ngn = CASE WHEN p_payment_currency = 'NGN'
        THEN v_product.price_ngn ELSE NULL END,
      amount_usdt = CASE WHEN p_payment_currency = 'USDT'
        THEN v_product.price_usdt ELSE NULL END,
      cost_usd = v_product.cost_usd,
      fx_rate_used = p_fx_rate,
      refund_policy = v_product.refund_policy,
      success_rate = v_product.success_rate,
      turnaround = v_product.turnaround,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  IF (p_payment_currency = 'NGN' AND v_order.amount_ngn IS NULL)
     OR (p_payment_currency = 'USDT' AND v_order.amount_usdt IS NULL) THEN
    RAISE EXCEPTION 'remediation product price is unavailable'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.petrock_order_events (
    order_id, event_type, from_status, to_status, metadata
  ) VALUES (
    p_order_id, 'offer_accepted', 'eligible', 'payment_pending',
    jsonb_build_object('currency', p_payment_currency, 'product_id', p_product_id)
  );
  RETURN NEXT v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_wallet_for_remediation(
  p_order_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid
)
RETURNS TABLE (success boolean, new_balance numeric, currency text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order public.petrock_orders%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_account public.customer_wallet_accounts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT * INTO v_order
  FROM public.petrock_orders o
  WHERE o.id = p_order_id
    AND o.customer_id = p_customer_id
    AND o.merchant_id = p_merchant_id
  FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'remediation order not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status IN ('paid', 'submitting', 'submitted', 'in_progress', 'completed') THEN
    RETURN QUERY SELECT true,
      CASE WHEN v_order.payment_currency = 'NGN'
        THEN (SELECT available_balance FROM public.customer_wallets
              WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id)
        ELSE (SELECT available_balance FROM public.customer_wallet_accounts
              WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
                AND customer_wallet_accounts.currency = 'USDT')
      END,
      v_order.payment_currency;
    RETURN;
  END IF;
  IF v_order.status <> 'payment_pending' THEN
    RAISE EXCEPTION 'remediation order is not payable' USING ERRCODE = '22023';
  END IF;

  IF v_order.payment_currency = 'NGN' THEN
    SELECT * INTO v_wallet
    FROM public.customer_wallets w
    WHERE w.customer_id = p_customer_id AND w.merchant_id = p_merchant_id
    FOR UPDATE;
    IF v_wallet.id IS NULL OR v_wallet.available_balance < v_order.amount_ngn THEN
      RAISE EXCEPTION 'insufficient_wallet_balance' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.customer_wallets
    SET available_balance = available_balance - v_order.amount_ngn,
        total_redeemed = total_redeemed + v_order.amount_ngn,
        updated_at = now()
    WHERE id = v_wallet.id
    RETURNING available_balance INTO v_wallet.available_balance;
    INSERT INTO public.customer_wallet_transactions (
      wallet_id, customer_id, merchant_id, type, amount, balance_after,
      source_type, source_id, status, description
    ) VALUES (
      v_wallet.id, p_customer_id, p_merchant_id, 'redemption',
      v_order.amount_ngn, v_wallet.available_balance, 'petrock_remediation',
      p_order_id, 'completed', 'Carrier unlock order'
    );
  ELSIF v_order.payment_currency = 'USDT' THEN
    SELECT * INTO v_account
    FROM public.customer_wallet_accounts a
    WHERE a.customer_id = p_customer_id AND a.merchant_id = p_merchant_id
      AND a.currency = 'USDT'
    FOR UPDATE;
    IF v_account.id IS NULL OR v_account.available_balance < v_order.amount_usdt THEN
      RAISE EXCEPTION 'insufficient_wallet_balance' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.customer_wallet_accounts
    SET available_balance = available_balance - v_order.amount_usdt,
        total_debited = total_debited + v_order.amount_usdt,
        updated_at = now()
    WHERE id = v_account.id
    RETURNING available_balance INTO v_account.available_balance;
    INSERT INTO public.customer_wallet_account_transactions (
      account_id, customer_id, merchant_id, currency, type, amount,
      balance_after, source_type, source_id, description
    ) VALUES (
      v_account.id, p_customer_id, p_merchant_id, 'USDT', 'debit',
      v_order.amount_usdt, v_account.available_balance, 'petrock_remediation',
      p_order_id, 'Carrier unlock order'
    );
  ELSE
    RAISE EXCEPTION 'unsupported remediation currency' USING ERRCODE = '22023';
  END IF;

  UPDATE public.petrock_orders
  SET status = 'paid', paid_at = now(), updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.petrock_order_events (
    order_id, event_type, from_status, to_status, metadata
  ) VALUES (
    p_order_id, 'wallet_captured', 'payment_pending', 'paid',
    jsonb_build_object('currency', v_order.payment_currency)
  );

  RETURN QUERY SELECT true,
    CASE WHEN v_order.payment_currency = 'NGN'
      THEN v_wallet.available_balance ELSE v_account.available_balance END,
    v_order.payment_currency;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_wallet_for_remediation(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order public.petrock_orders%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_account public.customer_wallet_accounts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.petrock_orders o
  WHERE o.id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'remediation order not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status = 'refunded' THEN RETURN true; END IF;
  IF v_order.status NOT IN ('failed', 'refund_pending') THEN
    RAISE EXCEPTION 'remediation order is not refundable' USING ERRCODE = '22023';
  END IF;

  IF v_order.payment_currency = 'NGN' THEN
    SELECT * INTO v_wallet FROM public.customer_wallets w
    WHERE w.customer_id = v_order.customer_id AND w.merchant_id = v_order.merchant_id
    FOR UPDATE;
    IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
    UPDATE public.customer_wallets
    SET available_balance = available_balance + v_order.amount_ngn,
        total_redeemed = GREATEST(total_redeemed - v_order.amount_ngn, 0),
        updated_at = now()
    WHERE id = v_wallet.id RETURNING available_balance INTO v_wallet.available_balance;
    INSERT INTO public.customer_wallet_transactions (
      wallet_id, customer_id, merchant_id, type, amount, balance_after,
      source_type, source_id, status, description
    ) VALUES (
      v_wallet.id, v_order.customer_id, v_order.merchant_id, 'refund',
      v_order.amount_ngn, v_wallet.available_balance,
      'petrock_remediation_refund', p_order_id, 'completed',
      COALESCE(p_reason, 'Carrier unlock refund')
    );
  ELSE
    SELECT * INTO v_account FROM public.customer_wallet_accounts a
    WHERE a.customer_id = v_order.customer_id AND a.merchant_id = v_order.merchant_id
      AND a.currency = 'USDT' FOR UPDATE;
    IF v_account.id IS NULL THEN RAISE EXCEPTION 'wallet account not found'; END IF;
    UPDATE public.customer_wallet_accounts
    SET available_balance = available_balance + v_order.amount_usdt,
        total_debited = GREATEST(total_debited - v_order.amount_usdt, 0),
        updated_at = now()
    WHERE id = v_account.id RETURNING available_balance INTO v_account.available_balance;
    INSERT INTO public.customer_wallet_account_transactions (
      account_id, customer_id, merchant_id, currency, type, amount,
      balance_after, source_type, source_id, description
    ) VALUES (
      v_account.id, v_order.customer_id, v_order.merchant_id, 'USDT', 'refund',
      v_order.amount_usdt, v_account.available_balance,
      'petrock_remediation_refund', p_order_id,
      COALESCE(p_reason, 'Carrier unlock refund')
    );
  END IF;

  UPDATE public.petrock_orders
  SET status = 'refunded', refunded_at = now(), completed_at = now(),
      identifier_ciphertext = NULL, feedback_token_hash = NULL,
      in_app_notified_at = COALESCE(in_app_notified_at, now()),
      failure_reason = COALESCE(p_reason, failure_reason), updated_at = now()
  WHERE id = p_order_id;
  INSERT INTO public.petrock_order_events (
    order_id, event_type, from_status, to_status, metadata
  ) VALUES (
    p_order_id, 'wallet_refunded', v_order.status, 'refunded',
    jsonb_build_object('currency', v_order.payment_currency)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_wallet_for_remediation(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_wallet_for_remediation(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_petrock_remediation_order(
  uuid, uuid, uuid, uuid, text, numeric
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_remediation(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_wallet_for_remediation(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_petrock_remediation_order(
  uuid, uuid, uuid, uuid, text, numeric
) TO service_role;
