-- Phase 1: functional storefront discount-code redemption.
--
-- A SECURITY DEFINER wrapper RPC `create_storefront_order_with_discount_code`
-- locks the discount_codes row FOR UPDATE, calls the unmodified
-- `create_storefront_order` (the VAT/parity trust boundary), and — only for a
-- fresh (non-replay) order — enforces the FULL policy in the database: window /
-- active, usage + per-customer limits, minimum purchase, targeted-code
-- eligibility against the created order items, and two-sided (exact ±1) amount
-- validation against the DB-computed subtotal. The DB is the only trust
-- boundary, so the RPC is safe to grant to anon (guest checkout).
--
-- Plus: extends `get_storefront_discount_code` (targeting fields +
-- inactive-inclusive mode + null-safe arrays), and enforces a DB-level
-- "used codes are immutable in identity" invariant (no hard-delete, no rename)
-- that direct mobile-admin / stale-client writes cannot bypass.

-- ============================================================================
-- 1. Schema changes
-- ============================================================================

-- Audit link from order -> code (nullable; nulled if the code is ever deleted).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code_id uuid
    REFERENCES public.discount_codes(id) ON DELETE SET NULL;

-- Index the new FK (repo rule: every FK is indexed).
CREATE INDEX IF NOT EXISTS idx_orders_discount_code_id
  ON public.orders (discount_code_id) WHERE discount_code_id IS NOT NULL;

-- Baseline has UNIQUE (discount_code_id, customer_email) on discount_code_usage
-- (`unique_customer_code`), which caps a customer at ONE usage row per code and
-- contradicts usage_limit_per_customer>1 (it would raise 23505 on the 2nd
-- redemption instead of our clean per_customer_limit_reached). Per-customer is
-- now enforced by the wrapper's count check under the FOR UPDATE lock.
ALTER TABLE public.discount_code_usage DROP CONSTRAINT IF EXISTS unique_customer_code;

-- Idempotency conflict target: one usage row per (code, order).
CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_code_usage_code_order
  ON public.discount_code_usage (discount_code_id, order_id) WHERE order_id IS NOT NULL;

-- Expression index matching the wrapper's per-customer lookup
-- (WHERE discount_code_id = ? AND lower(customer_email) = ?) so popular codes
-- don't scan many rows while holding the FOR UPDATE lock.
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_lower_email
  ON public.discount_code_usage (discount_code_id, (pg_catalog.lower((customer_email)::text)));

-- DB-level enforcement of the used-code invariant: mobile-admin and stale
-- clients write discount_codes directly under staff RLS, so app-layer guards are
-- defense-in-depth, not the source of truth.
-- (1) A used code cannot be hard-deleted: flip the usage FK CASCADE -> RESTRICT
--     (unused codes, with no usage rows, still delete normally). The trigger
--     below adds the clearer domain error and also catches usage_count drift.
ALTER TABLE public.discount_code_usage
  DROP CONSTRAINT IF EXISTS discount_code_usage_discount_code_id_fkey;
ALTER TABLE public.discount_code_usage
  ADD CONSTRAINT discount_code_usage_discount_code_id_fkey
  FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE RESTRICT;

-- (2) A used code cannot be renamed or hard-deleted. "Used" = any usage row OR
--     any linked order OR a non-zero usage_count (historical drift can leave one
--     signal without the others).
CREATE OR REPLACE FUNCTION public.prevent_used_discount_code_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_usage boolean;
BEGIN
  SELECT
    COALESCE(OLD.usage_count, 0) > 0
    OR EXISTS (
      SELECT 1 FROM public.discount_code_usage u WHERE u.discount_code_id = OLD.id
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.discount_code_id = OLD.id
    )
  INTO v_has_usage;

  IF TG_OP = 'DELETE' THEN
    IF v_has_usage THEN
      RAISE EXCEPTION 'discount_code_delete_not_allowed';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code AND v_has_usage THEN
    RAISE EXCEPTION 'discount_code_rename_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_used_discount_code_identity_mutation
  ON public.discount_codes;
CREATE TRIGGER prevent_used_discount_code_identity_mutation
  BEFORE UPDATE OF code OR DELETE ON public.discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_used_discount_code_identity_mutation();

-- Normalize the nullable columns the redemption RPC depends on: existing rows
-- may carry NULL usage_count / applies_to, which would silently bypass quota
-- checks and misroute eligibility. Backfill, then harden.
UPDATE public.discount_codes SET usage_count = 0 WHERE usage_count IS NULL;
UPDATE public.discount_codes SET applies_to = 'all' WHERE applies_to IS NULL;
ALTER TABLE public.discount_codes
  ALTER COLUMN usage_count SET DEFAULT 0,
  ALTER COLUMN usage_count SET NOT NULL,
  ALTER COLUMN applies_to  SET DEFAULT 'all',
  ALTER COLUMN applies_to  SET NOT NULL;

-- Preflight clamp guarantees no row violates the invariant, then add it as a
-- normal (validated) CHECK. (A NOT VALID + immediate VALIDATE still scans and
-- would fail on dirty data — clamping first is what actually makes it safe.)
UPDATE public.discount_codes
SET usage_count = usage_limit
WHERE usage_limit IS NOT NULL AND usage_count > usage_limit;

-- Idempotent ADD (no `ADD CONSTRAINT IF NOT EXISTS` for CHECK in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_codes_usage_count_within_limit'
      AND conrelid = 'public.discount_codes'::regclass
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_usage_count_within_limit
      CHECK (usage_limit IS NULL OR usage_count <= usage_limit);
  END IF;
END $$;

-- ============================================================================
-- 2. Extend get_storefront_discount_code (targeting fields + inactive mode +
--    null-safe arrays + search_path hardening)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_storefront_discount_code(uuid, text);

CREATE OR REPLACE FUNCTION public.get_storefront_discount_code(
  p_merchant_id uuid,
  p_code text,
  p_include_inactive boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  minimum_purchase_amount numeric,
  maximum_discount_amount numeric,
  usage_limit integer,
  usage_count integer,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean,
  applies_to text,
  product_ids jsonb,
  category_ids jsonb,
  usage_limit_per_customer integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_code IS NULL OR pg_catalog.btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required';
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.code::text,
    dc.description::text,
    dc.discount_type::text,
    dc.discount_value,
    dc.minimum_purchase_amount,
    dc.maximum_discount_amount,
    dc.usage_limit,
    dc.usage_count,
    dc.starts_at,
    dc.expires_at,
    dc.is_active,
    COALESCE(dc.applies_to, 'all')::text,
    COALESCE(dc.product_ids, '[]'::jsonb),
    COALESCE(dc.category_ids, '[]'::jsonb),
    dc.usage_limit_per_customer
  FROM public.discount_codes dc
  WHERE dc.merchant_id = p_merchant_id
    AND pg_catalog.upper(dc.code) = pg_catalog.upper(pg_catalog.btrim(p_code))
    AND (p_include_inactive OR dc.is_active = true)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_discount_code(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_discount_code(uuid, text, boolean)
  TO anon, authenticated, service_role;

-- ============================================================================
-- 3. Self-policing, replay-first redemption RPC
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_storefront_order_with_discount_code(
  p_merchant_id uuid, p_customer_email text, p_customer_name text, p_items jsonb,
  p_customer_phone text DEFAULT NULL, p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card', p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending', p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store', p_notes text DEFAULT NULL, p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL, p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL, p_user_id uuid DEFAULT NULL, p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0, p_expected_total numeric DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL, p_checkout_request_hash text DEFAULT NULL,
  p_discount_code_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, order_number text, tracking_token text, subtotal numeric, shipping_fee numeric,
  discount_amount numeric, tax_amount numeric, total numeric, customer_id uuid, customer_email text,
  customer_name text, customer_phone text, payment_status text, shipping_status text,
  payment_method text, shipping_address jsonb, merchant_id uuid, tax_basis text,
  gift_wrapping_fee numeric, idempotency_replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code        record;
  v_order       record;
  v_now         timestamptz := pg_catalog.now();
  v_norm_email  text := pg_catalog.lower(pg_catalog.btrim(p_customer_email));
  v_per_cust    integer;
  v_expected    numeric;
  v_eligible    boolean;
  v_inserted_id uuid;
BEGIN
  IF p_discount_code_id IS NULL THEN
    RAISE EXCEPTION 'discount_code_required';
  END IF;

  -- Lock the code row up front (ownership + existence). Held through commit so
  -- concurrent first-time redemptions of a limited code are serialized.
  SELECT
    dc.id, dc.code, dc.discount_type, dc.discount_value, dc.minimum_purchase_amount,
    dc.maximum_discount_amount, dc.usage_limit, dc.usage_count, dc.starts_at,
    dc.expires_at, dc.is_active, dc.applies_to, dc.product_ids, dc.category_ids,
    dc.usage_limit_per_customer
  INTO v_code
  FROM public.discount_codes dc
  WHERE dc.id = p_discount_code_id AND dc.merchant_id = p_merchant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'discount_code_not_found'; END IF;

  -- Create (or idempotently replay) the order via the unmodified trust-boundary RPC.
  SELECT
    created.id, created.order_number, created.tracking_token, created.subtotal,
    created.shipping_fee, created.discount_amount, created.tax_amount, created.total,
    created.customer_id, created.customer_email, created.customer_name, created.customer_phone,
    created.payment_status, created.shipping_status, created.payment_method, created.shipping_address,
    created.merchant_id, created.tax_basis, created.gift_wrapping_fee, created.idempotency_replayed
  INTO v_order
  FROM public.create_storefront_order(
    p_merchant_id => p_merchant_id, p_customer_email => p_customer_email,
    p_customer_name => p_customer_name, p_items => p_items, p_customer_phone => p_customer_phone,
    p_shipping_fee => p_shipping_fee,
    p_discount_amount => GREATEST(COALESCE(p_discount_amount, 0), 0),
    p_tax_amount => p_tax_amount, p_payment_method => p_payment_method,
    p_payment_status => p_payment_status, p_shipping_status => p_shipping_status,
    p_shipping_address => p_shipping_address, p_source => p_source, p_notes => p_notes,
    p_ad_tracking => p_ad_tracking, p_selected_quote_id => p_selected_quote_id,
    p_shipping_provider => p_shipping_provider, p_tracking_number => p_tracking_number,
    p_user_id => p_user_id, p_tax_basis => p_tax_basis, p_gift_wrapping_fee => p_gift_wrapping_fee,
    p_expected_total => p_expected_total, p_checkout_idempotency_key => p_checkout_idempotency_key,
    p_checkout_request_hash => p_checkout_request_hash
  ) AS created;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'discount_order_creation_failed'; END IF;

  -- REPLAY: the order already existed; the first call already enforced policy and
  -- recorded usage. Return as-is WITHOUT re-checking limits or re-recording usage,
  -- so a legitimate retry is never rejected once quota is consumed.
  IF v_order.idempotency_replayed THEN
    RETURN QUERY SELECT
      v_order.id, v_order.order_number, v_order.tracking_token, v_order.subtotal,
      v_order.shipping_fee, v_order.discount_amount, v_order.tax_amount, v_order.total,
      v_order.customer_id, v_order.customer_email, v_order.customer_name, v_order.customer_phone,
      v_order.payment_status, v_order.shipping_status, v_order.payment_method, v_order.shipping_address,
      v_order.merchant_id, v_order.tax_basis, v_order.gift_wrapping_fee, v_order.idempotency_replayed;
    RETURN;
  END IF;

  -- FRESH redemption: enforce the FULL policy in-DB. Any RAISE rolls the order
  -- back atomically (no orphan order, no stock leak).
  IF v_code.is_active IS NOT TRUE THEN RAISE EXCEPTION 'code_inactive'; END IF;
  IF v_code.starts_at IS NOT NULL AND v_code.starts_at > v_now THEN RAISE EXCEPTION 'code_not_started'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < v_now THEN RAISE EXCEPTION 'code_expired'; END IF;
  IF v_code.usage_limit IS NOT NULL AND COALESCE(v_code.usage_count, 0) >= v_code.usage_limit THEN
    RAISE EXCEPTION 'usage_limit_reached'; END IF;

  SELECT pg_catalog.count(*) INTO v_per_cust FROM public.discount_code_usage u
  WHERE u.discount_code_id = v_code.id
    AND pg_catalog.lower((u.customer_email)::text) = v_norm_email;
  IF v_per_cust >= COALESCE(v_code.usage_limit_per_customer, 1) THEN
    RAISE EXCEPTION 'per_customer_limit_reached'; END IF;

  IF v_code.minimum_purchase_amount IS NOT NULL AND v_order.subtotal < v_code.minimum_purchase_amount THEN
    RAISE EXCEPTION 'minimum_purchase_not_met'; END IF;

  -- Eligibility against the ACTUAL created order items. COALESCE applies_to so a
  -- legacy NULL routes to 'all', never the category branch. Category match checks
  -- BOTH the product's primary category_id and product_categories membership.
  IF COALESCE(v_code.applies_to, 'all') = 'all' THEN
    v_eligible := true;
  ELSIF COALESCE(v_code.applies_to, 'all') = 'specific_products' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = v_order.id
        AND oi.product_id::text IN (
          SELECT pg_catalog.jsonb_array_elements_text(COALESCE(v_code.product_ids, '[]'::jsonb)))
    ) INTO v_eligible;
  ELSE  -- specific_categories
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = v_order.id
        AND (
          EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = oi.product_id
              AND p.category_id::text IN (
                SELECT pg_catalog.jsonb_array_elements_text(COALESCE(v_code.category_ids, '[]'::jsonb)))
          )
          OR EXISTS (
            SELECT 1 FROM public.product_categories pc
            WHERE pc.product_id = oi.product_id
              AND pc.category_id::text IN (
                SELECT pg_catalog.jsonb_array_elements_text(COALESCE(v_code.category_ids, '[]'::jsonb)))
          )
        )
    ) INTO v_eligible;
  END IF;
  IF NOT v_eligible THEN RAISE EXCEPTION 'discount_code_not_eligible'; END IF;

  -- Two-sided amount validation against the AUTHORITATIVE subtotal: the applied
  -- discount must EQUAL what the code grants (±1), so a direct anon caller can
  -- neither over-claim NOR under-apply (e.g. 0) to burn quota. Whole-unit
  -- rounding mirrors computeDiscountAmountForSubtotal() so TS, route, and SQL agree.
  IF v_code.discount_type = 'percentage' THEN
    v_expected := pg_catalog.round(v_order.subtotal * v_code.discount_value / 100.0, 0);
    IF v_code.maximum_discount_amount IS NOT NULL THEN
      v_expected := LEAST(v_expected, pg_catalog.round(v_code.maximum_discount_amount, 0));
    END IF;
  ELSE
    v_expected := pg_catalog.round(v_code.discount_value, 0);
  END IF;
  v_expected := GREATEST(0, LEAST(v_expected, pg_catalog.round(v_order.subtotal, 0)));

  IF pg_catalog.abs(v_order.discount_amount - v_expected) > 1 THEN
    RAISE EXCEPTION 'discount_amount_mismatch'
      USING DETAIL = pg_catalog.format('applied=%s expected=%s subtotal=%s',
        v_order.discount_amount, v_expected, v_order.subtotal);
  END IF;

  -- Record usage (ON CONFLICT is belt-and-suspenders; on a fresh order it inserts).
  INSERT INTO public.discount_code_usage (discount_code_id, customer_email, order_id, discount_amount, used_at)
  VALUES (v_code.id, v_norm_email, v_order.id, v_order.discount_amount, v_now)
  ON CONFLICT (discount_code_id, order_id) WHERE order_id IS NOT NULL DO NOTHING
  RETURNING discount_code_usage.id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    UPDATE public.discount_codes SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = v_now
    WHERE discount_codes.id = v_code.id
      AND (discount_codes.usage_limit IS NULL OR COALESCE(discount_codes.usage_count, 0) < discount_codes.usage_limit);
    UPDATE public.orders SET discount_code_id = v_code.id
    WHERE orders.id = v_order.id AND orders.discount_code_id IS NULL;
  END IF;

  RETURN QUERY SELECT
    v_order.id, v_order.order_number, v_order.tracking_token, v_order.subtotal,
    v_order.shipping_fee, v_order.discount_amount, v_order.tax_amount, v_order.total,
    v_order.customer_id, v_order.customer_email, v_order.customer_name, v_order.customer_phone,
    v_order.payment_status, v_order.shipping_status, v_order.payment_method, v_order.shipping_address,
    v_order.merchant_id, v_order.tax_basis, v_order.gift_wrapping_fee, v_order.idempotency_replayed;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid) IS
  'Atomically validates + claims a storefront discount code and creates the order. Replay-first; for fresh orders enforces window/usage/per-customer/minimum-purchase/eligibility and a two-sided exact (±1) amount check against the DB subtotal, then records usage idempotently per (code, order). Self-policing, so granted to anon.';
