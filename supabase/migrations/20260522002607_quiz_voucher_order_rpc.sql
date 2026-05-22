-- Phase 1b quiz voucher order redemption.
--
-- The public /api/orders route verifies the signed quiz voucher token and then
-- calls this authenticated-only RPC with a route proof. The RPC still enforces
-- the database-owned boundaries: one voucher award per order, the award belongs
-- to the authenticated customer for the merchant, the award is approved store
-- credit, and the award is claimed atomically with order creation.

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS quiz_award_id uuid REFERENCES public.quiz_awards(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_quiz_award_id_unique
ON public.order_items (quiz_award_id)
WHERE quiz_award_id IS NOT NULL;

COMMENT ON COLUMN public.order_items.quiz_award_id IS
  'Quiz store-credit award redeemed by this order item, if the item was purchased through the proof-gated quiz voucher order path.';

DROP FUNCTION IF EXISTS public.create_storefront_order_with_quiz_voucher(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb
);

CREATE OR REPLACE FUNCTION public.create_storefront_order_with_quiz_voucher(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_award_amount numeric;
  v_award_id uuid;
  v_order record;
  v_order_item_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_condition text;
  v_voucher_item jsonb;
  v_voucher_item_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_user_required';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  WITH voucher_items AS (
    SELECT item
    FROM pg_catalog.jsonb_array_elements(p_items) AS item
    WHERE NULLIF(pg_catalog.btrim(item->>'voucher_award_id'), '') IS NOT NULL
  )
  SELECT
    pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(item))[1]
    INTO v_voucher_item_count, v_voucher_item
  FROM voucher_items;

  IF v_voucher_item_count <> 1 THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  BEGIN
    v_award_id := NULLIF(pg_catalog.btrim(v_voucher_item->>'voucher_award_id'), '')::uuid;
    v_product_id := COALESCE(
      NULLIF(v_voucher_item->>'product_id', '')::uuid,
      NULLIF(v_voucher_item->>'productId', '')::uuid,
      NULLIF(v_voucher_item->>'id', '')::uuid
    );
    v_variant_id := NULLIF(v_voucher_item->>'variant_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END;

  v_condition := NULLIF(pg_catalog.btrim(COALESCE(v_voucher_item->>'condition', '')), '');

  IF v_award_id IS NULL OR v_product_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  IF NOT public.quiz_route_proof_valid(
    p_route_proof,
    'create_storefront_order_with_quiz_voucher',
    v_award_id::text,
    p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_route_proof_required' USING ERRCODE = 'QZ010';
  END IF;

  SELECT qa.amount
    INTO v_award_amount
  FROM public.quiz_awards qa
  JOIN public.quiz_events qe ON qe.id = qa.event_id
  JOIN public.customers c ON c.id = qa.customer_id
  WHERE qa.id = v_award_id
    AND qe.merchant_id = p_merchant_id
    AND c.user_id = p_user_id
  FOR UPDATE OF qa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_awards qa
    WHERE qa.id = v_award_id
      AND qa.status <> 'approved'
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_approved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_awards qa
    WHERE qa.id = v_award_id
      AND qa.award_type <> 'store_credit'
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_award_invalid_type';
  END IF;

  SELECT *
    INTO v_order
  FROM public.create_storefront_order(
    p_merchant_id => p_merchant_id,
    p_customer_email => p_customer_email,
    p_customer_name => p_customer_name,
    p_items => p_items,
    p_customer_phone => p_customer_phone,
    p_shipping_fee => p_shipping_fee,
    p_discount_amount => COALESCE(p_discount_amount, 0) + COALESCE(v_award_amount, 0),
    p_tax_amount => p_tax_amount,
    p_payment_method => p_payment_method,
    p_payment_status => p_payment_status,
    p_shipping_status => p_shipping_status,
    p_shipping_address => p_shipping_address,
    p_source => p_source,
    p_notes => p_notes,
    p_ad_tracking => p_ad_tracking,
    p_selected_quote_id => p_selected_quote_id,
    p_shipping_provider => p_shipping_provider,
    p_tracking_number => p_tracking_number,
    p_user_id => p_user_id,
    p_tax_basis => p_tax_basis,
    p_gift_wrapping_fee => p_gift_wrapping_fee,
    p_expected_total => p_expected_total
  );

  UPDATE public.order_items
  SET quiz_award_id = v_award_id
  WHERE id = (
    SELECT oi.id
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
      AND oi.product_id = v_product_id
      AND oi.variant_id IS NOT DISTINCT FROM v_variant_id
      AND (v_condition IS NULL OR oi.condition IS NOT DISTINCT FROM v_condition)
      AND oi.quiz_award_id IS NULL
    ORDER BY oi.created_at, oi.id
    LIMIT 1
  )
  RETURNING public.order_items.id INTO v_order_item_id;

  IF v_order_item_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_order_item_not_found';
  END IF;

  UPDATE public.quiz_awards
  SET status = 'claimed',
      claimed_at = pg_catalog.now(),
      route_proof_id = p_route_proof->>'proof_id'
  WHERE id = v_award_id
    AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_approved';
  END IF;

  RETURN QUERY
  SELECT
    v_order.id::uuid,
    v_order.order_number::text,
    v_order.tracking_token::text,
    v_order.subtotal::numeric,
    v_order.shipping_fee::numeric,
    v_order.discount_amount::numeric,
    v_order.tax_amount::numeric,
    v_order.total::numeric,
    v_order.customer_id::uuid,
    v_order.customer_email::text,
    v_order.customer_name::text,
    v_order.customer_phone::text,
    v_order.payment_status::text,
    v_order.shipping_status::text,
    v_order.payment_method::text,
    v_order.shipping_address::jsonb,
    v_order.merchant_id::uuid,
    v_order.tax_basis::text,
    v_order.gift_wrapping_fee::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_quiz_voucher(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_quiz_voucher(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb
) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_storefront_order_with_quiz_voucher(
  uuid,
  text,
  text,
  jsonb,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  uuid,
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  jsonb
) IS
  'Creates a storefront order for exactly one signed quiz store-credit voucher award. Requires quiz route proof, authenticated p_user_id, approved award ownership, and atomically claims the award while linking it to order_items.quiz_award_id.';
