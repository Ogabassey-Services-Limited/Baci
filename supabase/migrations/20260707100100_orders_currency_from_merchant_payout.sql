-- Derive order currency from the merchant payout currency (multi-country rollout).
--
-- Before this change every storefront and quiz-prize order silently inherited the
-- 'NGN' column default because neither writer supplied a currency. This redefines
-- the two order-writing routines so each order records the merchant payout currency
-- (falling back to 'NGN' when unset). The redefinitions are transcribed from the
-- live production definitions; the only behavioural delta is the currency plumbing
-- described inline below. The Naira-only chat-order converter is intentionally left
-- untouched (it keeps its explicit currency guard).

CREATE OR REPLACE FUNCTION private.create_storefront_order(p_merchant_id uuid, p_customer_email text, p_customer_name text, p_items jsonb, p_customer_phone text DEFAULT NULL::text, p_shipping_fee numeric DEFAULT 0, p_discount_amount numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_payment_method text DEFAULT 'card'::text, p_payment_status text DEFAULT 'unpaid'::text, p_shipping_status text DEFAULT 'pending'::text, p_shipping_address jsonb DEFAULT NULL::jsonb, p_source text DEFAULT 'online_store'::text, p_notes text DEFAULT NULL::text, p_ad_tracking jsonb DEFAULT NULL::jsonb, p_selected_quote_id uuid DEFAULT NULL::uuid, p_shipping_provider text DEFAULT NULL::text, p_tracking_number text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_tax_basis text DEFAULT 'exclusive'::text, p_gift_wrapping_fee numeric DEFAULT 0, p_expected_total numeric DEFAULT NULL::numeric, p_checkout_idempotency_key text DEFAULT NULL::text, p_checkout_request_hash text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, order_number text, tracking_token text, subtotal numeric, shipping_fee numeric, discount_amount numeric, tax_amount numeric, total numeric, customer_id uuid, customer_email text, customer_name text, customer_phone text, payment_status text, shipping_status text, payment_method text, shipping_address jsonb, merchant_id uuid, tax_basis text, gift_wrapping_fee numeric, idempotency_replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_gift_wrapping_fee NUMERIC := COALESCE(p_gift_wrapping_fee, 0);
  v_tax_basis TEXT := lower(trim(COALESCE(p_tax_basis, 'exclusive')));
  v_merchant_vat_status TEXT;
  v_merchant_vat_rate NUMERIC;
  v_expected_tax NUMERIC;
  -- Multi-country delta: order currency, defaulting to Naira until the merchant
  -- payout currency is read below.
  v_currency TEXT := 'NGN';
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
  v_checkout_idempotency_key TEXT := NULLIF(trim(COALESCE(p_checkout_idempotency_key, '')), '');
  v_checkout_request_hash TEXT := NULLIF(trim(COALESCE(p_checkout_request_hash, '')), '');
  v_existing_order RECORD;
  v_idempotency_replayed BOOLEAN := false;
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

  IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required';
  END IF;

  IF v_tax_basis NOT IN ('exclusive', 'inclusive') THEN
    RAISE EXCEPTION 'invalid_tax_basis';
  END IF;

  v_tax_basis := 'exclusive';

  IF v_gift_wrapping_fee < 0 THEN
    RAISE EXCEPTION 'gift_wrapping_fee_negative';
  END IF;

  PERFORM 1 FROM public.merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  IF v_checkout_idempotency_key IS NOT NULL THEN
    IF v_checkout_request_hash IS NULL THEN
      RAISE EXCEPTION 'checkout_request_hash_required';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        p_merchant_id::text || ':checkout:' || v_checkout_idempotency_key,
        0
      )
    );

    SELECT
      o.id,
      o.order_number,
      o.tracking_token,
      o.subtotal,
      o.shipping_fee,
      o.discount_amount,
      o.tax_amount,
      o.total,
      o.customer_id,
      o.customer_email,
      o.customer_name,
      o.customer_phone,
      o.payment_status,
      o.shipping_status,
      o.payment_method,
      o.shipping_address,
      o.merchant_id,
      o.tax_basis,
      o.gift_wrapping_fee,
      o.checkout_request_hash
    INTO v_existing_order
    FROM public.orders o
    WHERE o.merchant_id = p_merchant_id
      AND o.checkout_idempotency_key = v_checkout_idempotency_key
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_order.checkout_request_hash IS DISTINCT FROM v_checkout_request_hash THEN
        RAISE EXCEPTION 'checkout_idempotency_conflict';
      END IF;

      IF v_existing_order.payment_status IN ('paid', 'bnpl_approved', 'refunded')
        OR COALESCE(v_existing_order.shipping_status, '') IN (
          'processing',
          'shipped',
          'out_for_delivery',
          'delivered',
          'completed',
          'cancelled'
        )
      THEN
        RAISE EXCEPTION 'order_not_reusable';
      END IF;

      UPDATE public.orders o
      SET
        payment_method = trim(p_payment_method),
        payment_status = v_payment_status,
        shipping_status = 'pending',
        updated_at = now()
      WHERE o.id = v_existing_order.id
      RETURNING
        o.id,
        o.order_number,
        o.tracking_token,
        o.subtotal,
        o.shipping_fee,
        o.discount_amount,
        o.tax_amount,
        o.total,
        o.customer_id,
        o.customer_email,
        o.customer_name,
        o.customer_phone,
        o.payment_status,
        o.shipping_status,
        o.payment_method,
        o.shipping_address,
        o.merchant_id,
        o.tax_basis,
        o.gift_wrapping_fee,
        o.checkout_request_hash
      INTO v_existing_order;

      RETURN QUERY
      SELECT
        v_existing_order.id,
        v_existing_order.order_number,
        v_existing_order.tracking_token,
        v_existing_order.subtotal,
        v_existing_order.shipping_fee,
        v_existing_order.discount_amount,
        v_existing_order.tax_amount,
        v_existing_order.total,
        v_existing_order.customer_id,
        v_existing_order.customer_email,
        v_existing_order.customer_name,
        v_existing_order.customer_phone,
        v_existing_order.payment_status,
        v_existing_order.shipping_status,
        v_existing_order.payment_method,
        v_existing_order.shipping_address,
        v_existing_order.merchant_id,
        v_existing_order.tax_basis,
        v_existing_order.gift_wrapping_fee,
        true;
      RETURN;
    END IF;
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
  LEFT JOIN public.products p ON p.id = r.product_id
    AND p.merchant_id = p_merchant_id
    AND p.status = 'active'
  LEFT JOIN public.product_variants v
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

  -- Multi-country delta: read the merchant payout currency alongside the existing
  -- VAT lookup; falls back to Naira when the payout currency is blank/unset.
  SELECT
    COALESCE(m.vat_registration_status, 'not_registered'),
    COALESCE(m.vat_rate, 7.5),
    COALESCE(NULLIF(trim(m.payout_currency), ''), 'NGN')
    INTO v_merchant_vat_status, v_merchant_vat_rate, v_currency
  FROM public.merchants m
  WHERE m.id = p_merchant_id;

  IF v_merchant_vat_status = 'registered' THEN
    IF v_tax_basis = 'exclusive' THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(p.vat_category_code, 'S') = 'S' THEN
            ROUND(
              ROUND(
                t.quantity * COALESCE(t.price_override, t.base_price),
                2
              )
              * COALESCE(p.vat_rate, 7.5) / 100,
              2
            )
          ELSE 0
        END
      ), 0)
        INTO v_expected_tax
      FROM tmp_storefront_order_items t
      JOIN public.products p ON p.id = t.product_id;

      IF ABS(v_tax_amount - v_expected_tax) > 1 THEN
        RAISE EXCEPTION 'tax_amount_mismatch'
          USING DETAIL = format(
            'expected=%s got=%s subtotal=%s vat_rate=%s',
            v_expected_tax, v_tax_amount, v_subtotal, v_merchant_vat_rate
          );
      END IF;
    END IF;
  ELSE
    IF v_tax_amount > 1 THEN
      RAISE EXCEPTION 'tax_amount_must_be_zero_for_non_vat_merchant'
        USING DETAIL = format('got=%s', v_tax_amount);
    END IF;
    v_tax_amount := 0;
  END IF;

  IF v_tax_basis = 'exclusive' THEN
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      + v_tax_amount
      - v_discount_amount;
  ELSE
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      - v_discount_amount;
  END IF;

  IF v_total < 0 THEN
    v_total := 0;
  END IF;

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
    FROM public.customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.user_id = p_user_id
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Δ-97 / Codex P1: phone-only fallback is restricted to GUEST
  -- checkouts (p_user_id IS NULL). Phone numbers are recycled by
  -- telcos (NIST SP 800-63B AAL1); auto-claiming an existing
  -- customer row from an authed checkout based on phone alone
  -- would let one auth user inherit a stranger's order history.
  IF v_customer_id IS NULL
    AND v_normalized_customer_phone IS NOT NULL
    AND p_user_id IS NULL
  THEN
    SELECT c.id
      INTO v_customer_id
    FROM public.customers c
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
    FROM public.customers c
    WHERE c.merchant_id = p_merchant_id
      AND lower(c.email) = v_normalized_customer_email
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET
      email = CASE
        WHEN (c.email IS NULL OR c.email = '')
          AND NOT EXISTS (
            SELECT 1
            FROM public.customers existing_email
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
          FROM public.customers existing_phone
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
        FROM public.customers existing_phone
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
        INSERT INTO public.customers (
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
        RETURNING customers.id INTO v_customer_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_customer_id := NULL;
        SELECT c.id INTO v_customer_id
        FROM public.customers c
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
          UPDATE public.customers c
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

  INSERT INTO public.orders (
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
    currency,
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
    gift_wrapping_fee,
    checkout_idempotency_key,
    checkout_request_hash
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
    v_currency,
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
    v_gift_wrapping_fee,
    v_checkout_idempotency_key,
    v_checkout_request_hash
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
      -- Verify tracking policy to bypass legacy decrement for serialized inventory
      DECLARE
        v_prod_policy TEXT;
        v_var_policy TEXT;
        v_effective_policy TEXT;
        v_variant_id UUID := stock_rec.variant_id;
      BEGIN
        SELECT inventory_tracking_policy INTO v_prod_policy
        FROM public.products
        WHERE products.id = stock_rec.product_id;

        IF v_variant_id IS NOT NULL THEN
          SELECT inventory_tracking_policy INTO v_var_policy
          FROM public.product_variants
          WHERE product_variants.id = v_variant_id;
        ELSE
          v_var_policy := 'inherit';
        END IF;

        v_effective_policy := public.get_effective_inventory_tracking_policy(v_prod_policy, v_var_policy);

        IF v_effective_policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
          -- Bypassed legacy stock decrement for serialized inventory tracking
          CONTINUE;
        END IF;
      END;

      IF stock_rec.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE product_variants.id = stock_rec.variant_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_variant_stock';
        END IF;
      ELSE
        UPDATE public.products
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE public.products.id = stock_rec.product_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_stock';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.order_items (
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
    assurance_fee,
    variant_attributes
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
    t.assurance_fee,
    COALESCE(t.variant_attributes, '{}'::jsonb)
  FROM tmp_storefront_order_items t;

  -- Claim serialized units for newly created order items
  DECLARE
    v_item RECORD;
  BEGIN
    FOR v_item IN
      SELECT oi.id, oi.product_id, oi.variant_id
      FROM public.order_items oi
      WHERE oi.order_id = v_order_id
    LOOP
      PERFORM private.claim_variant_inventory_units_for_order_item_internal(
        p_merchant_id,
        v_order_id,
        v_item.id
      );
    END LOOP;
  END;

  SELECT o.total, o.tax_amount
    INTO v_total, v_tax_amount
  FROM public.orders o
  WHERE o.id = v_order_id;

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
    v_gift_wrapping_fee,
    v_idempotency_replayed;
END;
$function$;

CREATE OR REPLACE FUNCTION private.create_quiz_product_prize_award_with_inventory(p_attempt_id uuid, p_event_id uuid, p_customer_id uuid, p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid, p_condition text DEFAULT NULL::text, p_route_proof jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_merchant_id uuid;
  v_active boolean;
  v_has_variants boolean;
  v_variant_model text;
  v_prod_policy text;
  v_var_policy text;
  v_effective_policy text;
  v_claim_variant_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_award_id uuid;
  v_customer_email text;
  v_customer_name text;
  v_customer_phone text;
  v_prize_amount numeric;
  v_claim_res jsonb;
  v_reserved_count integer;
  v_variant_name text;
  v_product_name text;
  -- Multi-country delta: prize-order currency, defaulting to Naira until the
  -- merchant payout currency is read below.
  v_currency text := 'NGN';
BEGIN
  -- 1. Lock quiz_attempts, quiz_events, customers, and existing matching awards FOR UPDATE
  PERFORM 1 FROM public.quiz_attempts WHERE id = p_attempt_id FOR UPDATE;
  PERFORM 1 FROM public.quiz_events WHERE id = p_event_id FOR UPDATE;

  SELECT c.merchant_id, c.email, (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::text, c.phone
  INTO v_merchant_id, v_customer_email, v_customer_name, v_customer_phone
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  -- Find existing award
  SELECT id, reserved_order_id INTO v_award_id, v_order_id
  FROM public.quiz_awards
  WHERE attempt_id = p_attempt_id
    AND award_type = 'store_credit'
    AND status <> 'void'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_award_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'awardId', v_award_id,
      'orderId', v_order_id,
      'alreadyExisted', true
    );
  END IF;

  -- 2. Validate product/variant
  SELECT p.merchant_id, (p.status = 'active'), p.has_variants, p.variant_model, p.inventory_tracking_policy, p.price, p.name
  INTO v_merchant_id, v_active, v_has_variants, v_variant_model, v_prod_policy, v_prize_amount, v_product_name
  FROM public.products p
  WHERE p.id = p_product_id;

  IF NOT FOUND OR NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_product_inactive_or_not_found');
  END IF;

  -- Check if variant belongs to product
  IF p_variant_id IS NOT NULL THEN
    SELECT pv.inventory_tracking_policy, COALESCE(pv.price_override, v_prize_amount), (SELECT public.format_order_item_variant_name(pv.attributes))
    INTO v_var_policy, v_prize_amount, v_variant_name
    FROM public.product_variants pv
    WHERE pv.id = p_variant_id
      AND pv.product_id = p_product_id
      AND pv.merchant_id = v_merchant_id
      AND pv.is_inventory_anchor IS NOT TRUE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_variant_invalid');
    END IF;
    v_claim_variant_id := p_variant_id;
  ELSE
    -- If product is variant product, require configured prize_variant_id
    IF (v_has_variants IS TRUE OR v_variant_model = 'sku_matrix') THEN
      RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_variant_id_required_for_variant_product');
    END IF;
    -- For simple product, let's ensure anchor variant exists
    PERFORM private.ensure_product_inventory_anchor_variant(v_merchant_id, p_product_id);
    SELECT inventory_anchor_variant_id INTO v_claim_variant_id
    FROM public.products
    WHERE id = p_product_id;

    SELECT pv.inventory_tracking_policy INTO v_var_policy
    FROM public.product_variants pv
    WHERE pv.id = v_claim_variant_id;

    v_variant_name := NULL;
  END IF;

  v_effective_policy := public.get_effective_inventory_tracking_policy(v_prod_policy, v_var_policy);

  -- 3. Check inventory if strict tracking
  IF v_effective_policy = 'serialized_strict' THEN
    -- Check how many clean units are available
    SELECT count(*)::integer INTO v_reserved_count
    FROM public.variant_inventory
    WHERE variant_id = v_claim_variant_id
      AND status = 'available'
      AND order_id IS NULL
      AND order_item_id IS NULL
      AND sold_at IS NULL;

    IF v_reserved_count < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'stock_exhausted');
    END IF;
  END IF;

  -- Multi-country delta: read the merchant payout currency for the prize order,
  -- falling back to Naira when the payout currency is blank/unset.
  SELECT COALESCE(NULLIF(trim(m.payout_currency), ''), 'NGN')
  INTO v_currency
  FROM public.merchants m
  WHERE m.id = v_merchant_id;

  -- 4. Create zero-total order and order item
  INSERT INTO public.orders (
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
    currency,
    payment_method,
    payment_status,
    shipping_status,
    source,
    notes,
    tax_basis
  ) VALUES (
    v_merchant_id,
    p_customer_id,
    COALESCE(v_customer_email, 'quiz-prize@baci.app'),
    COALESCE(v_customer_name, 'Quiz Winner'),
    v_customer_phone,
    0,
    0,
    0,
    0,
    0,
    v_currency,
    'quiz_award',
    'paid',
    'pending',
    'quiz_prize',
    'Quiz prize award reservation',
    'exclusive'
  ) RETURNING id INTO v_order_id;

  -- Insert order item
  INSERT INTO public.order_items (
    order_id,
    product_id,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    condition,
    variant_attributes
  ) VALUES (
    v_order_id,
    p_product_id,
    p_variant_id, -- variant_id is NULL for simple products to match catalog
    v_variant_name,
    v_product_name,
    0,
    1,
    p_condition,
    '{}'::jsonb
  ) RETURNING id INTO v_order_item_id;

  -- 5. Create approved award row
  INSERT INTO public.quiz_awards (
    amount,
    approved_at,
    attempt_id,
    award_type,
    customer_id,
    event_id,
    status,
    product_id,
    variant_id,
    condition,
    reserved_order_id,
    reserved_order_item_id
  ) VALUES (
    v_prize_amount,
    now(),
    p_attempt_id,
    'store_credit',
    p_customer_id,
    p_event_id,
    'approved',
    p_product_id,
    p_variant_id,
    p_condition,
    v_order_id,
    v_order_item_id
  ) RETURNING id INTO v_award_id;

  -- 6. Claim inventory
  PERFORM private.claim_variant_inventory_units_for_order_item_internal(
    v_merchant_id,
    v_order_id,
    v_order_item_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'awardId', v_award_id,
    'orderId', v_order_id,
    'orderItemId', v_order_item_id,
    'alreadyExisted', false
  );
END;
$function$;
