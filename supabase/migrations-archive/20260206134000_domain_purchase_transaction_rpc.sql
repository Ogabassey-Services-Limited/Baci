-- Create a secure function for domain purchase transactions

CREATE OR REPLACE FUNCTION public.create_domain_purchase_transaction(
  p_domain text,
  p_tld text,
  p_years integer,
  p_amount numeric,
  p_cost_price numeric,
  p_sell_price numeric,
  p_category text,
  p_reference text,
  p_gateway text DEFAULT 'paystack',
  p_currency text DEFAULT 'NGN'
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_merchant_id uuid;
  v_transaction transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    SELECT merchant_id INTO v_merchant_id
    FROM staff_members
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Merchant not found';
  END IF;

  IF p_years IS NULL OR p_years < 1 THEN
    RAISE EXCEPTION 'Invalid years';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF p_domain IS NULL OR length(trim(p_domain)) = 0 THEN
    RAISE EXCEPTION 'Invalid domain';
  END IF;

  INSERT INTO transactions (
    merchant_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    platform_fee,
    merchant_amount,
    description,
    metadata
  )
  VALUES (
    v_merchant_id,
    'payment',
    p_amount,
    COALESCE(p_currency, 'NGN'),
    'pending',
    COALESCE(p_gateway, 'paystack'),
    p_reference,
    COALESCE(p_sell_price, p_amount) - COALESCE(p_cost_price, 0),
    0,
    format('Domain purchase: %s for %s year(s)', p_domain, p_years),
    jsonb_build_object(
      'domain', p_domain,
      'tld', p_tld,
      'years', p_years,
      'transaction_type', 'domain_purchase',
      'cost_price', p_cost_price,
      'sell_price', p_sell_price,
      'category', p_category
    )
  )
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text
) TO authenticated;
