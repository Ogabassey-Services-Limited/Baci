CREATE OR REPLACE FUNCTION public.petrock_model_scope_matches(
  p_device_model text,
  p_model_scope jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  v_model text := lower(trim(p_device_model));
  v_kind text := p_model_scope ->> 'kind';
  v_required_family text := lower(trim(COALESCE(p_model_scope ->> 'family', '')));
  v_family text;
  v_canonical text;
  v_series integer;
  v_match text[];
  v_min_text text := p_model_scope ->> 'min';
  v_max_text text := p_model_scope ->> 'max';
BEGIN
  IF v_model IS NULL OR v_model = '' OR p_model_scope IS NULL THEN
    RETURN false;
  END IF;

  v_match := regexp_match(v_model, 'iphone\s*([0-9]{1,2})', 'i');
  IF v_match IS NOT NULL THEN
    v_family := 'iphone';
    v_series := v_match[1]::integer;
    v_canonical := 'iphone-' || v_match[1];
  ELSE
    v_match := regexp_match(v_model, 'ipad(?:\s+pro|\s+air)?\s*([0-9]{1,2})?', 'i');
    IF v_match IS NOT NULL THEN
      v_family := 'ipad';
      v_series := CASE WHEN v_match[1] IS NULL THEN NULL ELSE v_match[1]::integer END;
      v_canonical := CASE WHEN v_match[1] IS NULL
        THEN 'ipad' ELSE 'ipad-' || v_match[1] END;
    ELSE
      v_match := regexp_match(v_model, '(?:samsung\s+)?galaxy\s+([a-z][0-9]{1,3})', 'i');
      IF v_match IS NOT NULL THEN
        v_family := 'samsung';
        v_canonical := 'samsung-' || lower(v_match[1]);
      ELSE
        v_family := 'other';
        v_canonical := trim(BOTH '-' FROM regexp_replace(v_model, '[^a-z0-9]+', '-', 'g'));
      END IF;
    END IF;
  END IF;

  IF v_required_family <> '' AND v_required_family <> v_family THEN
    RETURN false;
  END IF;
  IF v_kind = 'generic' THEN RETURN true; END IF;
  IF v_kind = 'range' THEN
    IF v_min_text !~ '^[0-9]+$' OR v_max_text !~ '^[0-9]+$' THEN
      RETURN false;
    END IF;
    RETURN v_series IS NOT NULL
      AND v_series >= v_min_text::integer
      AND v_series <= v_max_text::integer;
  END IF;
  IF v_kind = 'set' AND jsonb_typeof(p_model_scope -> 'models') = 'array' THEN
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_model_scope -> 'models') AS candidate(model)
      WHERE lower(trim(candidate.model)) = v_canonical
    );
  END IF;
  RETURN false;
END;
$$;

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
     OR v_product.status_segment <> v_order.status_segment
     OR NOT public.petrock_model_scope_matches(
       v_order.device_model,
       v_product.model_scope
     ) THEN
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

REVOKE ALL ON FUNCTION public.petrock_model_scope_matches(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_petrock_remediation_order(
  uuid, uuid, uuid, uuid, text, numeric
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_petrock_remediation_order(
  uuid, uuid, uuid, uuid, text, numeric
) TO service_role;
