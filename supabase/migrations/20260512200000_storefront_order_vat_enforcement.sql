-- Phase B — B3.5 (Δ-31, Δ-39, Δ-42, Δ-47, Δ-50). Web checkout VAT/total
-- parity at the RPC boundary.
--
-- Background: the storefront UI calculates VAT and shows it to the
-- customer, but the active checkout POST omits `tax_amount` from its
-- `/api/orders` body. The API defaults missing VAT to 0; the
-- `create_storefront_order` RPC accepts whatever it's given; then the
-- post-insert `update_order_tax_totals` trigger overwrites
-- `orders.tax_amount` from line-item VAT without recomputing
-- `orders.total`. The end-user is shown a VAT-inclusive figure but
-- pays the VAT-exclusive total. This is the Efosa-payment root-cause
-- bug for the FIRS step (canonical order's totals don't satisfy
-- either tax-exclusive or tax-inclusive shape, so FIRS + loyalty
-- side-effects abort with `financial_totals_inconsistent`).
--
-- B3.5 (per plan §5 B3.5):
--   (a) RPC adds two NEW params: `p_tax_basis TEXT DEFAULT 'exclusive'`
--       and `p_gift_wrapping_fee NUMERIC DEFAULT 0`. Subtotal stays
--       server-derived from `p_items` (Δ-47); total stays
--       server-derived. NO `p_subtotal` or `p_total` params.
--   (b) RPC enforces VAT for VAT-registered merchants by recomputing
--       `expected_tax := round(subtotal * vat_rate / 100, 2)` and
--       requiring `|p_tax_amount - expected_tax| ≤ 1` when
--       `p_tax_basis = 'exclusive'`. Non-registered merchants must
--       pass `p_tax_amount = 0`. The RPC is the enforcement boundary
--       (Δ-42): storefront calls it via PostgREST anon, so revoking
--       anon access would break checkout.
--   (c) RPC recomputes `v_total` server-side per the matched basis:
--         exclusive → subtotal + shipping + gift + tax - discount
--         inclusive → subtotal + shipping + gift - discount
--       Persists `tax_basis`, `gift_wrapping_fee`, `tax_amount`,
--       `total` atomically.
--   (d) `update_order_tax_totals` trigger updated: for `tax_basis =
--       'exclusive'` orders the trigger recomputes `total` alongside
--       `tax_amount`, `tax_exclusive_amount`, `tax_inclusive_amount`.
--       For `tax_basis = 'inclusive'` orders `total` is invariant;
--       only the breakdown columns change. Never leaves a path where
--       `tax_amount` changes without `total` for exclusive orders.
--
-- Δ-50: `orders.tax_basis` and `orders.gift_wrapping_fee` columns
--   already exist (added by A0's `20260509110000_…` migration). This
--   migration does NOT re-add them; it only updates the RPC signature
--   and the trigger body.
--
-- Δ-47: NO `p_subtotal` or `p_total` params. Subtotal is computed
--   from `p_items` (existing baseline behavior at the `SELECT SUM(...)
--   INTO v_subtotal` line); total is computed per the matched basis.
--   Trusting the client total would re-open the Δ-31 attack surface.
--
-- B3 (Δ-9): the shipping_quote_required guard from
-- 20260512180000_storefront_order_require_quote_id.sql stays exactly
-- as-is. Everything else outside the VAT block is unchanged from the
-- B3 migration.

-- Adding 2 new params to the signature creates a NEW PostgreSQL
-- function identity (function identity = name + arg-type list,
-- defaults don't disambiguate). Without an explicit DROP the old
-- 19-arg overload sticks around and PostgREST callers that submit
-- exactly 19 args route to the stale function, bypassing B3.5's VAT
-- enforcement. DROP IF EXISTS the old signature first, then CREATE
-- the new 21-arg signature and re-GRANT to anon/authenticated/
-- service_role (Δ-71 pattern from Phase A's `record_merchant_settlement`
-- DROP+CREATE+GRANT — `CREATE OR REPLACE` preserves grants only when
-- the signature is identical).
-- DROP both the prior 19-arg (B3) AND the intermediate 21-arg
-- (initial B3.5 push) signatures. The first push of this PR
-- introduced a 21-arg overload; reviewer feedback (Codex P1)
-- required moving the parity check into the RPC, which adds another
-- param (`p_expected_total`). Without dropping the 21-arg version
-- here, callers that route via positional args could hit the stale
-- overload that lacks the parity check.
DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID
);
DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC
);

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_merchant_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'card',
  p_payment_status TEXT DEFAULT 'unpaid',
  p_shipping_status TEXT DEFAULT 'pending',
  p_shipping_address JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'online_store',
  p_notes TEXT DEFAULT NULL,
  p_ad_tracking JSONB DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL,
  p_shipping_provider TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_tax_basis TEXT DEFAULT 'exclusive',
  p_gift_wrapping_fee NUMERIC DEFAULT 0,
  p_expected_total NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  discount_amount NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  payment_status TEXT,
  shipping_status TEXT,
  payment_method TEXT,
  shipping_address JSONB,
  merchant_id UUID,
  tax_basis TEXT,
  gift_wrapping_fee NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_trimmed_customer_name TEXT := trim(p_customer_name);
  v_normalized_customer_email TEXT := lower(trim(p_customer_email));
  v_normalized_customer_phone TEXT := NULLIF(trim(COALESCE(p_customer_phone, '')), '');
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := COALESCE(p_shipping_fee, 0);
  v_discount_amount NUMERIC := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_tax_amount NUMERIC := COALESCE(p_tax_amount, 0);
  -- Defer the non-negative clamp to the validation block below.
  -- Pre-fix this DECLARE used GREATEST(.., 0), which silently
  -- normalized `-5` to `0` and made the `gift_wrapping_fee_negative`
  -- check unreachable. Keep the COALESCE so NULL still becomes 0 (a
  -- legitimate "no gift wrap" signal), but let actual negatives
  -- flow through to the validation RAISE.
  v_gift_wrapping_fee NUMERIC := COALESCE(p_gift_wrapping_fee, 0);
  v_tax_basis TEXT := lower(trim(COALESCE(p_tax_basis, 'exclusive')));
  v_merchant_vat_status TEXT;
  v_merchant_vat_rate NUMERIC;
  v_expected_tax NUMERIC;
  v_total NUMERIC := 0;
  v_payment_method TEXT := p_payment_method;
  v_payment_status TEXT := 'unpaid';
  v_shipping_status TEXT := p_shipping_status;
  v_shipping_address JSONB := p_shipping_address;
  v_user_id UUID := auth.uid();
  v_customer_record_phone TEXT;
  v_invalid_item_count INTEGER;
  v_invalid_quantity_count INTEGER;
  v_invalid_variant_count INTEGER;
  v_retry_attempt INT := 0;
  stock_rec RECORD;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'customer_email_required';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'customer_name_required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  IF public.is_agentic_checkout_context() THEN
    p_user_id := NULL;
  ELSIF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_set_user_id_anonymously';
  END IF;

  IF p_payment_status IS NOT NULL AND trim(p_payment_status) <> '' THEN
    v_payment_status := lower(trim(p_payment_status));

    IF v_payment_status NOT IN ('unpaid', 'pending') THEN
      RAISE EXCEPTION 'invalid_payment_status';
    END IF;
  END IF;

  -- B3 (plan §5 B3): shipping-provider/quote linkage.
  IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required';
  END IF;

  -- B3.5 (Δ-47, Δ-50): tax_basis enum validation. The default is
  -- 'exclusive' for back-compat — legacy callers that don't supply
  -- `p_tax_basis` get exactly the pre-B3.5 behavior.
  IF v_tax_basis NOT IN ('exclusive', 'inclusive') THEN
    RAISE EXCEPTION 'invalid_tax_basis';
  END IF;

  -- B3.5 (Δ-34): gift_wrapping_fee must be non-negative. Defensive
  -- alongside the column's CHECK constraint so we surface a friendly
  -- error code instead of a generic 23514 constraint violation.
  IF v_gift_wrapping_fee < 0 THEN
    RAISE EXCEPTION 'gift_wrapping_fee_negative';
  END IF;

  PERFORM 1 FROM merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  v_first_name := split_part(v_trimmed_customer_name, ' ', 1);
  IF position(' ' in v_trimmed_customer_name) > 0 THEN
    v_last_name := trim(substring(v_trimmed_customer_name from position(' ' in v_trimmed_customer_name) + 1));
  ELSE
    v_last_name := NULL;
  END IF;

  DROP TABLE IF EXISTS pg_temp.tmp_storefront_order_items;

  CREATE TEMP TABLE tmp_storefront_order_items (
    product_id UUID,
    condition TEXT,
    image_url TEXT,
    variant_id UUID,
    variant_attributes JSONB,
    variant_name TEXT,
    quantity INTEGER,
    has_assurance BOOLEAN,
    assurance_fee NUMERIC,
    product_name TEXT,
    base_price NUMERIC,
    price_override NUMERIC,
    manage_stock BOOLEAN,
    variant_stock INTEGER
  ) ON COMMIT DROP;

  INSERT INTO tmp_storefront_order_items (
    product_id,
    condition,
    image_url,
    variant_id,
    variant_attributes,
    variant_name,
    quantity,
    has_assurance,
    assurance_fee,
    product_name,
    base_price,
    price_override,
    manage_stock,
    variant_stock
  )
  SELECT
    r.product_id,
    COALESCE(NULLIF(trim(r.condition), ''), p.condition),
    r.image_url,
    r.variant_id,
    r.variant_attributes,
    COALESCE(
      public.format_order_item_variant_name(v.attributes),
      public.format_order_item_variant_name(r.variant_attributes)
    ),
    r.quantity,
    r.has_assurance,
    r.assurance_fee,
    p.name,
    p.price,
    v.price_override,
    p.manage_stock,
    v.stock_quantity
  FROM (
    SELECT
      COALESCE(
        NULLIF(item->>'product_id','')::uuid,
        NULLIF(item->>'productId','')::uuid,
        NULLIF(item->>'id','')::uuid
      ) AS product_id,
      NULLIF(trim(item->>'condition'), '') AS condition,
      NULLIF(trim(COALESCE(item->>'image_url', item->>'imageUrl')), '') AS image_url,
      NULLIF(item->>'variant_id','')::uuid AS variant_id,
      COALESCE(item->'variant_attributes', item->'variantAttributes') AS variant_attributes,
      (item->>'quantity')::int AS quantity,
      COALESCE((item->>'has_assurance')::boolean, false) AS has_assurance,
      GREATEST(COALESCE((item->>'assurance_fee')::numeric, 0), 0) AS assurance_fee
    FROM jsonb_array_elements(p_items) AS item
  ) AS r
  LEFT JOIN products p ON p.id = r.product_id
    AND p.merchant_id = p_merchant_id
    AND p.status = 'active'
  LEFT JOIN product_variants v
    ON r.variant_id IS NOT NULL
    AND v.id = r.variant_id
    AND v.product_id = p.id;

  SELECT
    COUNT(*) FILTER (WHERE t.product_id IS NULL OR t.product_name IS NULL) AS invalid_item_count,
    COUNT(*) FILTER (WHERE t.quantity IS NULL OR t.quantity <= 0) AS invalid_quantity_count,
    COUNT(*) FILTER (
      WHERE t.variant_id IS NOT NULL AND t.variant_stock IS NULL
    ) AS invalid_variant_count
  INTO v_invalid_item_count, v_invalid_quantity_count, v_invalid_variant_count
  FROM tmp_storefront_order_items t;

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF v_invalid_quantity_count > 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF v_invalid_variant_count > 0 THEN
    RAISE EXCEPTION 'invalid_variant';
  END IF;

  SELECT COALESCE(SUM((COALESCE(t.price_override, t.base_price) * t.quantity) + t.assurance_fee), 0)
    INTO v_subtotal
  FROM tmp_storefront_order_items t;

  v_shipping_fee := GREATEST(v_shipping_fee, 0);
  v_tax_amount := GREATEST(v_tax_amount, 0);

  -- B3.5 (Δ-42): VAT enforcement at the RPC boundary. We can't revoke
  -- anon access without breaking storefront checkout, so the RPC must
  -- police itself.
  --
  -- Read merchant VAT config. Default `vat_rate` to 7.5 (the NG VAT
  -- rate) matching the column default; default
  -- `vat_registration_status` to `'not_registered'`.
  SELECT
    COALESCE(m.vat_registration_status, 'not_registered'),
    COALESCE(m.vat_rate, 7.5)
    INTO v_merchant_vat_status, v_merchant_vat_rate
  FROM merchants m
  WHERE m.id = p_merchant_id;

  IF v_merchant_vat_status = 'registered' THEN
    IF v_tax_basis = 'exclusive' THEN
      -- Codex P1 (PR #1622): compute expected tax PER-LINE,
      -- matching the post-insert `update_order_tax_totals`
      -- trigger formula exactly. The trigger sums
      -- `order_items.vat_amount`, which the per-row defaults
      -- trigger sets to
      --   ROUND(line_extension * vat_rate / 100, 2)
      -- ONLY for category 'S' items (standard-rated);
      -- category 'O'/'Z' (zero-rated / exempt) and uncategorized
      -- items contribute 0. The prior uniform
      --   round(v_subtotal * v_merchant_vat_rate / 100, 2)
      -- formula treated every item as 'S' — so a mixed-category
      -- order would PASS the parity check at insert time, then
      -- the post-insert trigger persisted a smaller tax_amount +
      -- total, the RPC re-read those, the gateway charged the
      -- reduced figure, and the customer paid less than they
      -- were quoted. That defeated the entire parity guard.
      --
      -- Match the trigger byte-for-byte:
      --   line_extension := ROUND(quantity * price, 2)
      --   vat_amount     := ROUND(line_extension * rate / 100, 2)
      -- where `price = COALESCE(price_override, base_price)` (the
      -- exact value persisted to `order_items.price`) and
      -- `rate = COALESCE(product.vat_rate, merchant.vat_rate)`
      -- (the trigger's NEW.vat_rate fallback).
      SELECT COALESCE(SUM(
        CASE
          WHEN p.vat_category_code = 'S' THEN
            ROUND(
              ROUND(
                t.quantity * COALESCE(t.price_override, t.base_price),
                2
              )
              * COALESCE(p.vat_rate, v_merchant_vat_rate) / 100,
              2
            )
          ELSE 0
        END
      ), 0)
        INTO v_expected_tax
      FROM tmp_storefront_order_items t
      JOIN products p ON p.id = t.product_id;

      IF ABS(v_tax_amount - v_expected_tax) > 1 THEN
        -- Use USING DETAIL so the message itself is the stable error
        -- code (matches the `clientErrorCodes.includes(message)` check
        -- in /api/orders). Dynamic values land in DETAIL where ops
        -- can inspect them via the Postgres log without breaking the
        -- API's code-based 4xx mapping.
        RAISE EXCEPTION 'tax_amount_mismatch'
          USING DETAIL = format(
            'expected=%s got=%s subtotal=%s vat_rate=%s',
            v_expected_tax, v_tax_amount, v_subtotal, v_merchant_vat_rate
          );
      END IF;
    END IF;
    -- For inclusive orders the merchant lists prices VAT-inclusive,
    -- so `p_tax_amount` is informational only. We don't recompute or
    -- enforce here; the line-item VAT breakdown is reconstructed by
    -- `update_order_tax_totals` after order_items are inserted.
  ELSE
    -- Non-registered merchants charge no VAT. Enforce loudly so a
    -- bug in the calculate-commerce action layer can't accidentally
    -- pocket non-existent tax.
    IF v_tax_amount > 1 THEN
      RAISE EXCEPTION 'tax_amount_must_be_zero_for_non_vat_merchant'
        USING DETAIL = format('got=%s', v_tax_amount);
    END IF;
    -- Clamp tiny rounding to exactly 0 so persistence is clean.
    v_tax_amount := 0;
  END IF;

  -- B3.5 (Δ-47): server-side total computation. The RPC is the source
  -- of truth; the API does a follow-on parity check vs the client's
  -- expected_total so the customer sees the same number they paid.
  IF v_tax_basis = 'exclusive' THEN
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      + v_tax_amount
      - v_discount_amount;
  ELSE
    -- 'inclusive': tax is already inside subtotal, gift wrapping and
    -- shipping are added on top (they're not VAT-inclusive by default
    -- in NG). p_tax_amount is informational only.
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      - v_discount_amount;
  END IF;

  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- B3.5 (Δ-39 + Codex P1): client/server total parity guard. Run
  -- BEFORE any side effects — customer upsert, order insert, and
  -- stock decrement all happen below this point, so RAISING after
  -- those would leave orphan rows and reserved inventory with no
  -- rollback path (the original API-level 409 had exactly this bug
  -- — Codex P1 on PR #1622). Inside the RPC the RAISE rolls back
  -- the whole transaction atomically: no order, no stock, safe to
  -- retry. NULL `p_expected_total` short-circuits the check so
  -- legacy callers (mobile-admin order creation, agentic) keep
  -- working unchanged.
  IF p_expected_total IS NOT NULL
    AND ABS(v_total - p_expected_total) > 1
  THEN
    RAISE EXCEPTION 'order_total_mismatch'
      USING DETAIL = format(
        'expected=%s computed=%s subtotal=%s shipping=%s gift=%s tax=%s discount=%s basis=%s',
        p_expected_total, v_total, v_subtotal, v_shipping_fee,
        v_gift_wrapping_fee, v_tax_amount, v_discount_amount, v_tax_basis
      );
  END IF;

  -- ====================================================================
  -- B2 (Δ-9): customer upsert hardened against all 4 unique indexes
  -- AND concurrent same-identity inserts. Block unchanged from the
  -- B2 migration.
  -- ====================================================================

  IF v_normalized_customer_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(p_merchant_id::text),
      hashtext(v_normalized_customer_phone)
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_merchant_id::text || ':' || p_user_id::text, 0)
    );
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_merchant_id::text || ':' || v_normalized_customer_email, 1
    )
  );

  IF p_user_id IS NOT NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.user_id = p_user_id
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Δ-97 / Codex P1: phone-only fallback is restricted to GUEST
  -- checkouts (`p_user_id IS NULL`). Phone numbers are recycled by
  -- telcos (~90 days, NIST SP 800-63B AAL1) and SIM-swappable, so
  -- matching an authenticated user to an existing customer row by
  -- phone alone — and then claiming that row by setting `user_id`
  -- in the UPDATE branch below — would let one auth user inherit
  -- a stranger's order history.
  IF v_customer_id IS NULL
    AND v_normalized_customer_phone IS NOT NULL
    AND p_user_id IS NULL
  THEN
    SELECT c.id
      INTO v_customer_id
    FROM customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.phone = v_normalized_customer_phone
      AND c.user_id IS NULL
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM customers c
    WHERE c.merchant_id = p_merchant_id
      AND lower(c.email) = v_normalized_customer_email
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE customers c
    SET
      email = CASE
        WHEN (c.email IS NULL OR c.email = '')
          AND NOT EXISTS (
            SELECT 1
            FROM customers existing_email
            WHERE existing_email.merchant_id = p_merchant_id
              AND lower(existing_email.email) = v_normalized_customer_email
              AND existing_email.id <> c.id
          )
          THEN v_normalized_customer_email
        ELSE c.email
      END,
      phone = CASE
        WHEN v_normalized_customer_phone IS NULL THEN c.phone
        WHEN c.phone = v_normalized_customer_phone THEN c.phone
        WHEN NOT EXISTS (
          SELECT 1
          FROM customers existing_phone
          WHERE existing_phone.merchant_id = p_merchant_id
            AND existing_phone.phone = v_normalized_customer_phone
            AND existing_phone.id <> c.id
        )
          THEN v_normalized_customer_phone
        ELSE c.phone
      END,
      user_id = CASE
        WHEN c.user_id IS NULL THEN p_user_id
        ELSE c.user_id
      END,
      first_name = COALESCE(c.first_name, v_first_name),
      last_name = COALESCE(c.last_name, v_last_name),
      updated_at = now()
    WHERE c.id = v_customer_id
    RETURNING c.id INTO v_customer_id;
  ELSE
    v_customer_record_phone := v_normalized_customer_phone;

    IF v_normalized_customer_phone IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM customers existing_phone
        WHERE existing_phone.merchant_id = p_merchant_id
          AND existing_phone.phone = v_normalized_customer_phone
      )
    THEN
      v_customer_record_phone := NULL;
    END IF;

    v_retry_attempt := 0;
    LOOP
      v_retry_attempt := v_retry_attempt + 1;
      IF v_retry_attempt > 3 THEN
        RAISE EXCEPTION 'customer_upsert_failed'
          USING HINT = 'Exhausted 3 retry attempts on customer upsert';
      END IF;

      BEGIN
        INSERT INTO customers (
          merchant_id,
          email,
          first_name,
          last_name,
          phone,
          user_id
        )
        VALUES (
          p_merchant_id,
          v_normalized_customer_email,
          v_first_name,
          v_last_name,
          v_customer_record_phone,
          p_user_id
        )
        RETURNING id INTO v_customer_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_customer_id := NULL;
        SELECT c.id INTO v_customer_id
        FROM customers c
        WHERE c.merchant_id = p_merchant_id
          AND (
            (p_user_id IS NOT NULL AND c.user_id = p_user_id)
            OR lower(c.email) = v_normalized_customer_email
          )
        ORDER BY
          CASE
            WHEN p_user_id IS NOT NULL AND c.user_id = p_user_id THEN 0
            ELSE 1
          END,
          c.id
        LIMIT 1;

        IF v_customer_id IS NOT NULL THEN
          UPDATE customers c
          SET
            phone = COALESCE(c.phone, v_customer_record_phone),
            user_id = COALESCE(c.user_id, p_user_id),
            first_name = COALESCE(c.first_name, v_first_name),
            last_name = COALESCE(c.last_name, v_last_name),
            email = COALESCE(NULLIF(c.email, ''), v_normalized_customer_email),
            updated_at = now()
          WHERE c.id = v_customer_id;
          EXIT;
        END IF;
      END;
    END LOOP;
  END IF;

  -- ====================================================================
  -- End B2 customer block.
  -- ====================================================================

  -- B3.5 (Δ-50): persist tax_basis + gift_wrapping_fee atomically with
  -- the rest of the order row. `tax_exclusive_amount` /
  -- `tax_inclusive_amount` are populated by the post-INSERT trigger
  -- from order_items VAT calculations, so we don't set them here.
  INSERT INTO orders (
    merchant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    subtotal,
    shipping_fee,
    discount_amount,
    tax_amount,
    total,
    payment_method,
    payment_status,
    shipping_status,
    shipping_address,
    source,
    notes,
    ad_tracking,
    selected_quote_id,
    shipping_provider,
    tracking_number,
    tax_basis,
    gift_wrapping_fee
  )
  VALUES (
    p_merchant_id,
    v_customer_id,
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_payment_method,
    v_payment_status,
    v_shipping_status,
    v_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    v_tax_basis,
    v_gift_wrapping_fee
  )
  RETURNING
    orders.id,
    orders.order_number,
    orders.tracking_token,
    orders.payment_method,
    orders.shipping_status,
    orders.shipping_address
  INTO
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_payment_method,
    v_shipping_status,
    v_shipping_address;

  FOR stock_rec IN
    SELECT
      t.product_id,
      t.variant_id,
      SUM(t.quantity)::INTEGER AS total_quantity,
      BOOL_OR(t.manage_stock) AS manage_stock
    FROM tmp_storefront_order_items t
    GROUP BY t.product_id, t.variant_id
    ORDER BY t.product_id, t.variant_id
  LOOP
    IF stock_rec.manage_stock THEN
      IF stock_rec.variant_id IS NOT NULL THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE product_variants.id = stock_rec.variant_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_variant_stock';
        END IF;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE products.id = stock_rec.product_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_stock';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO order_items (
    order_id,
    product_id,
    condition,
    image_url,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    has_assurance,
    assurance_fee
  )
  SELECT
    v_order_id,
    t.product_id,
    t.condition,
    t.image_url,
    t.variant_id,
    t.variant_name,
    t.product_name,
    COALESCE(t.price_override, t.base_price),
    t.quantity,
    t.has_assurance,
    t.assurance_fee
  FROM tmp_storefront_order_items t;

  -- B3.5 (Codex P1): re-read the canonical `total` and `tax_amount`
  -- after the order_items INSERT fires `update_order_tax_totals`.
  -- For `tax_basis = 'exclusive'` the trigger recomputes `total`
  -- from line-item VAT, which can differ from the RPC's
  -- pre-trigger `v_total` even within the ±1 NGN VAT tolerance
  -- (per-line `ROUND` accumulates differently than aggregate
  -- `ROUND`, and items with category 'O'/'Z' contribute 0 to
  -- `SUM(vat_amount)` regardless of merchant rate). Returning
  -- `v_total` here would mean the API computes the gateway charge
  -- from a value that's already drifted from the persisted
  -- `orders.total` — payment ≠ row. Re-SELECT keeps the returned
  -- shape consistent with the row.
  SELECT total, tax_amount
    INTO v_total, v_tax_amount
  FROM orders
  WHERE id = v_order_id;

  RETURN QUERY
  SELECT
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_customer_id,
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_payment_status,
    v_shipping_status,
    v_payment_method,
    v_shipping_address,
    p_merchant_id,
    v_tax_basis,
    v_gift_wrapping_fee;
END;
$$;

-- Re-GRANT to the same roles the baseline migration granted the
-- 19-arg signature to. DROP+CREATE wipes function grants, so this
-- block is mandatory — storefront callers are `anon` via PostgREST
-- and would 403 without it.
REVOKE ALL ON FUNCTION public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
) TO anon;
GRANT ALL ON FUNCTION public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
) TO authenticated;
GRANT ALL ON FUNCTION public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
) TO service_role;

COMMENT ON FUNCTION public.create_storefront_order(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  JSONB,
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  NUMERIC,
  NUMERIC
) IS
  'Creates storefront orders. B3.5 (Δ-42, Δ-47, Δ-50): RPC is the VAT enforcement boundary because storefront calls it via PostgREST anon. New params `p_tax_basis` (''exclusive''|''inclusive'', default ''exclusive''), `p_gift_wrapping_fee` (default 0), and `p_expected_total` (Codex P1 — checked BEFORE side effects so a mismatch rolls back the whole transaction; NULL skips the check). For VAT-registered merchants on exclusive basis, the RPC RAISES `tax_amount_mismatch` if `|p_tax_amount - round(subtotal * vat_rate / 100, 2)| > 1`. For non-registered merchants, RAISES `tax_amount_must_be_zero_for_non_vat_merchant` if `p_tax_amount > 1`. Total is server-derived per the matched basis (Δ-47: no `p_subtotal` / `p_total` params). The returned `tax_amount` and `total` are re-read post-trigger so the API never returns a value that drifts from the persisted row.';


-- B3.5 trigger update (Δ-50): keep `orders.total` consistent with
-- `orders.tax_amount` for `tax_basis = 'exclusive'` orders.
--
-- Pre-B3.5 the trigger updated `tax_amount`, `tax_exclusive_amount`,
-- and `tax_inclusive_amount` whenever order_items changed, but left
-- `orders.total` alone. For exclusive orders this means a checkout
-- that included VAT in `total` could end up with `tax_amount`
-- updated by the trigger and `total` unchanged — the user paid
-- `total`, FIRS records the trigger's `tax_amount`, and the row
-- fails the `total = subtotal + shipping + gift + tax - discount`
-- invariant. This is the Δ-31 / Δ-38 root cause for FIRS +
-- loyalty side-effects.
--
-- For inclusive orders the trigger only updates the breakdown
-- columns; `total` is invariant by definition (tax is inside
-- `subtotal`). NULL `tax_basis` rows fall through to the
-- pre-B3.5 behavior so the trigger remains safe for orders
-- that haven't been classified yet by the A0 backfill.
CREATE OR REPLACE FUNCTION public.update_order_tax_totals() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $$
DECLARE
  order_uuid UUID;
  new_tax_exclusive NUMERIC(12, 2);
  new_tax_amount NUMERIC(12, 2);
  merchant_vat_status TEXT;
  order_tax_basis TEXT;
  order_subtotal NUMERIC(12, 2);
  order_shipping_fee NUMERIC(12, 2);
  order_gift_wrapping_fee NUMERIC(12, 2);
  order_discount_amount NUMERIC(12, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    order_uuid := OLD.order_id;
  ELSE
    order_uuid := NEW.order_id;
  END IF;

  -- B3.5 (Δ-50): read tax_basis + total components in the same lookup
  -- as merchant VAT status. We need them BEFORE the UPDATE so we
  -- compute the new total atomically.
  SELECT
    m.vat_registration_status,
    o.tax_basis,
    o.subtotal,
    o.shipping_fee,
    COALESCE(o.gift_wrapping_fee, 0),
    COALESCE(o.discount_amount, 0)
    INTO
      merchant_vat_status,
      order_tax_basis,
      order_subtotal,
      order_shipping_fee,
      order_gift_wrapping_fee,
      order_discount_amount
  FROM orders o
  JOIN merchants m ON o.merchant_id = m.id
  WHERE o.id = order_uuid;

  SELECT
    COALESCE(SUM(line_extension_amount), 0),
    COALESCE(SUM(vat_amount), 0)
    INTO new_tax_exclusive, new_tax_amount
  FROM order_items
  WHERE order_id = order_uuid;

  -- B3.5 (Δ-50): for exclusive orders we MUST recompute total
  -- alongside tax_amount. For inclusive orders total is invariant.
  -- For NULL tax_basis (unclassified backfill rows) we fall back to
  -- pre-B3.5 behavior (breakdown columns only) so this trigger
  -- doesn't change historical totals out from under ops.
  IF order_tax_basis = 'exclusive' THEN
    UPDATE orders
    SET
      tax_exclusive_amount = new_tax_exclusive,
      tax_amount = new_tax_amount,
      tax_inclusive_amount = new_tax_exclusive + new_tax_amount,
      -- Codex P1 (PR #1622): mirror the RPC's
      -- `IF v_total < 0 THEN v_total := 0` clamp. Without
      -- `GREATEST(0, ...)` here, a discount larger than
      -- subtotal+shipping+gift+tax (possible via guest-checkout
      -- payloads or coupon edge cases) writes a NEGATIVE total back
      -- to the row, the RPC's post-trigger re-SELECT then returns
      -- that negative, and the API hands the gateway a nonsense
      -- amount. The clamp keeps the row financially sane even when
      -- inputs are pathological.
      total = GREATEST(
        0,
        order_subtotal
        + order_shipping_fee
        + order_gift_wrapping_fee
        + new_tax_amount
        - order_discount_amount
      ),
      invoice_issue_date = COALESCE(invoice_issue_date, CURRENT_DATE),
      tax_point_date = COALESCE(tax_point_date, CURRENT_DATE)
    WHERE id = order_uuid;
  ELSE
    UPDATE orders
    SET
      tax_exclusive_amount = new_tax_exclusive,
      tax_amount = new_tax_amount,
      tax_inclusive_amount = new_tax_exclusive + new_tax_amount,
      invoice_issue_date = COALESCE(invoice_issue_date, CURRENT_DATE),
      tax_point_date = COALESCE(tax_point_date, CURRENT_DATE)
    WHERE id = order_uuid;
  END IF;

  IF merchant_vat_status = 'registered' THEN
    INSERT INTO order_tax_subtotals (order_id, vat_category_code, vat_rate, taxable_amount, tax_amount)
    SELECT
      order_uuid,
      vat_category_code,
      vat_rate,
      SUM(line_extension_amount),
      SUM(vat_amount)
    FROM order_items
    WHERE order_id = order_uuid
    GROUP BY vat_category_code, vat_rate
    ON CONFLICT (order_id, vat_category_code, vat_rate) DO UPDATE
      SET taxable_amount = EXCLUDED.taxable_amount,
          tax_amount = EXCLUDED.tax_amount;
  END IF;

  RETURN NEW;
END;
$$;
