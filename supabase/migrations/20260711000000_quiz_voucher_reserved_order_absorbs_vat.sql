-- Serialized/reserved quiz prizes: record the merchant-absorbed VAT + delivery.
--
-- The reserved-order branch of create_storefront_order_with_quiz_voucher (used
-- for serialized-inventory prizes with a pre-minted reserved_order_id) updated
-- shipping_fee and marked the order paid, but never applied the route-computed
-- p_tax_amount, and left `total` at the reservation's 0. So a taxable or shipped
-- serialized prize (e.g. an IMEI/serial-number device) redeemed with zero VAT
-- and an inconsistent total, and — because the branch returns the order already
-- `paid` — skipped the route's finalize_quiz_voucher_order_payment residual
-- check entirely.
--
-- Fix: the reserved branch now records tax_amount = p_tax_amount and
-- total = p_tax_amount + p_shipping_fee (the merchant-absorbed amounts), keeping
-- the order self-consistent (total = subtotal[0] + tax + shipping - discount[0])
-- and $0-due to the shopper. This mirrors the legacy path, where
-- create_storefront_order already lands total at tax + shipping. Only the two
-- new SET clauses differ from the deployed definition.

CREATE OR REPLACE FUNCTION private.create_storefront_order_with_quiz_voucher(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL::text,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card'::text,
  p_payment_status text DEFAULT 'unpaid'::text,
  p_shipping_status text DEFAULT 'pending'::text,
  p_shipping_address jsonb DEFAULT NULL::jsonb,
  p_source text DEFAULT 'online_store'::text,
  p_notes text DEFAULT NULL::text,
  p_ad_tracking jsonb DEFAULT NULL::jsonb,
  p_selected_quote_id uuid DEFAULT NULL::uuid,
  p_shipping_provider text DEFAULT NULL::text,
  p_tracking_number text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_tax_basis text DEFAULT 'exclusive'::text,
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL::numeric,
  p_route_proof jsonb DEFAULT '{}'::jsonb
)
 RETURNS TABLE(id uuid, order_number text, tracking_token text, subtotal numeric, shipping_fee numeric, discount_amount numeric, tax_amount numeric, total numeric, customer_id uuid, customer_email text, customer_name text, customer_phone text, payment_status text, shipping_status text, payment_method text, shipping_address jsonb, merchant_id uuid, tax_basis text, gift_wrapping_fee numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_reserved_order_id uuid;
  v_reserved_order_item_id uuid;
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

  SELECT qa.amount, qa.reserved_order_id, qa.reserved_order_item_id
    INTO v_award_amount, v_reserved_order_id, v_reserved_order_item_id
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

  -- 1. Check if a reserved order already exists for this award (serialized prize case)
  IF v_reserved_order_id IS NOT NULL THEN
    SELECT o.id, o.order_number, o.tracking_token, o.subtotal, o.shipping_fee, o.discount_amount, o.tax_amount, o.total, o.customer_id, o.customer_email, o.customer_name, o.customer_phone, o.payment_status, o.shipping_status, o.payment_method, o.shipping_address, o.merchant_id, o.tax_basis, o.gift_wrapping_fee
    INTO v_order
    FROM public.orders o
    WHERE o.id = v_reserved_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'quiz_voucher_reserved_order_not_found';
    END IF;

    -- Update order with shipping & user fields
    UPDATE public.orders
    SET
      customer_email = lower(trim(p_customer_email)),
      customer_name = trim(p_customer_name),
      customer_phone = NULLIF(trim(COALESCE(p_customer_phone, '')), ''),
      shipping_fee = COALESCE(p_shipping_fee, 0),
      -- Record the merchant-absorbed VAT + delivery on the reserved order so a
      -- taxable/shipped serialized prize is not left at the reservation's zero
      -- tax/total. subtotal + discount stay 0 (a free prize), so keeping
      -- total = tax + shipping preserves total = subtotal + tax + shipping -
      -- discount and leaves nothing due to the shopper.
      tax_amount = COALESCE(p_tax_amount, 0),
      total = COALESCE(p_tax_amount, 0) + COALESCE(p_shipping_fee, 0),
      payment_method = trim(p_payment_method),
      payment_status = CASE WHEN p_payment_method IN ('pod', 'pay_on_delivery') THEN 'pending' ELSE 'paid' END,
      shipping_address = p_shipping_address,
      shipping_provider = COALESCE(p_shipping_provider, shipping_provider),
      selected_quote_id = COALESCE(p_selected_quote_id, selected_quote_id),
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE orders.id = v_reserved_order_id
    RETURNING
      orders.id,
      orders.order_number,
      orders.tracking_token,
      orders.subtotal,
      orders.shipping_fee,
      orders.discount_amount,
      orders.tax_amount,
      orders.total,
      orders.customer_id,
      orders.customer_email,
      orders.customer_name,
      orders.customer_phone,
      orders.payment_status,
      orders.shipping_status,
      orders.payment_method,
      orders.shipping_address,
      orders.merchant_id,
      orders.tax_basis,
      orders.gift_wrapping_fee
    INTO v_order;

    -- Update the quiz award to claimed
    UPDATE public.quiz_awards
    SET status = 'claimed',
        claimed_at = pg_catalog.now(),
        route_proof_id = p_route_proof->>'proof_id'
    WHERE quiz_awards.id = v_award_id;

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
    RETURN;
  END IF;

  -- 2. Legacy / fallback path
  SELECT
    created.id,
    created.order_number,
    created.tracking_token,
    created.subtotal,
    created.shipping_fee,
    created.discount_amount,
    created.tax_amount,
    created.total,
    created.customer_id,
    created.customer_email,
    created.customer_name,
    created.customer_phone,
    created.payment_status,
    created.shipping_status,
    created.payment_method,
    created.shipping_address,
    created.merchant_id,
    created.tax_basis,
    created.gift_wrapping_fee
    INTO v_order
  FROM private.create_storefront_order(
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
  ) AS created;

  UPDATE public.order_items
  SET quiz_award_id = v_award_id
  WHERE order_items.id = (
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
  WHERE quiz_awards.id = v_award_id
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
$function$;
