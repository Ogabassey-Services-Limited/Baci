-- Lock create_domain_purchase_transaction to service-role callers.
--
-- The 11-arg variant is EXECUTE-granted to authenticated users, which exposes
-- caller-supplied pricing: the payments webhook verifies the Paystack amount
-- against the transaction row's own amount and fulfills registration from row
-- metadata, so a direct RPC call could plant an arbitrarily-cheap row for an
-- expensive domain and skip the route's custom_domain plan gate. Adding a
-- 12-arg service-role-only variant (p_user_id explicit, since auth.uid() is
-- NULL under the service role) removes that surface; the route calls it via
-- the admin client after its own auth + permission + plan checks, and the RPC
-- still re-verifies check_staff_permission(p_user_id, p_merchant_id,
-- 'settings', 'edit') as defense in depth.
--
-- The legacy 11-arg variant must no longer be callable by authenticated users:
-- only the new 12-arg service-role overload is part of the purchase route.

CREATE OR REPLACE FUNCTION public.create_domain_purchase_transaction(
  p_domain text,
  p_tld text,
  p_years integer,
  p_amount numeric,
  p_cost_price numeric,
  p_sell_price numeric,
  p_category text,
  p_reference text,
  p_gateway text,
  p_currency text,
  p_merchant_id uuid,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: requires service_role' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'user and merchant are required';
  END IF;

  -- Strict input validation: SECURITY DEFINER writing a financial row.
  IF p_domain IS NULL
    OR p_domain <> lower(p_domain)
    OR p_domain !~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'invalid domain';
  END IF;
  IF p_tld IS NULL OR p_tld !~ '^(\.[a-z]{2,}){1,2}$'
    OR right(p_domain, length(p_tld)) <> p_tld THEN
    RAISE EXCEPTION 'invalid tld';
  END IF;
  IF p_years IS NULL OR p_years < 1 OR p_years > 10 THEN
    RAISE EXCEPTION 'invalid years';
  END IF;
  IF p_cost_price IS NULL OR p_cost_price < 0
    OR p_sell_price IS NULL OR p_sell_price < p_cost_price
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount <> p_sell_price THEN
    RAISE EXCEPTION 'invalid pricing';
  END IF;
  IF p_reference IS NULL OR p_reference !~ '^DOM-[A-Z0-9]{12}$' THEN
    RAISE EXCEPTION 'invalid reference';
  END IF;
  IF p_gateway IS DISTINCT FROM 'paystack' THEN
    RAISE EXCEPTION 'unsupported gateway';
  END IF;
  IF p_currency IS DISTINCT FROM 'NGN' THEN
    RAISE EXCEPTION 'unsupported currency';
  END IF;
  IF p_category IS NULL OR length(p_category) > 64 THEN
    RAISE EXCEPTION 'invalid category';
  END IF;

  IF NOT public.check_staff_permission(p_user_id, p_merchant_id, 'settings', 'edit') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (
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
  ) VALUES (
    p_merchant_id,
    'payment',
    p_amount,
    p_currency,
    'pending',
    p_gateway,
    p_reference,
    p_sell_price - p_cost_price,
    0,
    'Domain purchase: ' || p_domain || ' for ' || p_years || ' year(s)',
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
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
) FROM service_role;

REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid, uuid
) TO service_role;
