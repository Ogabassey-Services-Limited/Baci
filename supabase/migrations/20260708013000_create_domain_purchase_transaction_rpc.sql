-- Create the RPC that apps/web/src/app/api/domains/initialize-payment/route.ts
-- has been calling since PR #245. The function was never shipped, so every
-- domain purchase failed with 500 "Failed to create payment" (web + mobile).
--
-- Inserts the pending domain-purchase transaction row that the
-- /api/domains/purchase route later verifies (Paystack status + ownership +
-- amount vs recomputed price + single-use), mirroring the pre-RPC insert shape.
-- Caller authorization mirrors the route: check_staff_permission(auth.uid(),
-- merchant, 'settings', 'edit') covers both owners and active staff.

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
  p_merchant_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_merchant_id uuid := p_merchant_id;
  v_candidate_count integer;
  v_transaction_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
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

  -- Resolve the acting merchant when not provided: merchants the caller owns
  -- plus active staff memberships that carry settings/edit.
  IF v_merchant_id IS NULL THEN
    SELECT min(c.m_id), count(*)
      INTO v_merchant_id, v_candidate_count
    FROM (
      SELECT m.id AS m_id
      FROM public.merchants AS m
      WHERE m.user_id = v_uid
      UNION
      SELECT sm.merchant_id
      FROM public.staff_members AS sm
      WHERE sm.user_id = v_uid
        AND sm.status = 'active'
        AND public.check_staff_permission(v_uid, sm.merchant_id, 'settings', 'edit')
    ) AS c;

    IF v_candidate_count = 0 OR v_merchant_id IS NULL THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    IF v_candidate_count > 1 THEN
      RAISE EXCEPTION 'multiple merchants for user; pass p_merchant_id';
    END IF;
  END IF;

  IF NOT public.check_staff_permission(v_uid, v_merchant_id, 'settings', 'edit') THEN
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
    v_merchant_id,
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
GRANT EXECUTE ON FUNCTION public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
) TO authenticated, service_role;

-- Reference idempotency for this flow, consistent with the sibling partial
-- unique indexes on transactions (klump, agentic, wallet).
CREATE UNIQUE INDEX IF NOT EXISTS transactions_domain_purchase_gateway_reference_unique_idx
ON public.transactions (gateway_reference)
WHERE gateway_reference IS NOT NULL
  AND gateway = 'paystack'
  AND (metadata ->> 'transaction_type') = 'domain_purchase';
