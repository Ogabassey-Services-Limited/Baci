-- Allow safe additions to orders whose existing item rows contain accounting
-- snapshots. The original edit RPC performs a full delete/reinsert, which is
-- intentionally blocked for those rows. This fallback preserves every existing
-- order_items row and inserts only the new line when the incoming item list is
-- a strict multiset superset of the persisted list.

DO $rename$
BEGIN
  IF to_regprocedure('public.update_admin_order_replace(uuid,jsonb)') IS NULL THEN
    IF to_regprocedure('public.update_admin_order(uuid,jsonb)') IS NULL THEN
      RAISE EXCEPTION 'public.update_admin_order(uuid,jsonb) is missing';
    END IF;

    ALTER FUNCTION public.update_admin_order(uuid, jsonb)
      RENAME TO update_admin_order_replace;
  END IF;
END;
$rename$;

CREATE OR REPLACE FUNCTION public.append_admin_order_items(
  p_order_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order record;
  v_before jsonb;
  v_after jsonb;
  v_items jsonb := COALESCE(p_payload -> 'items', '[]'::jsonb);
  v_existing_items jsonb := '[]'::jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_added_item jsonb;
  v_existing_shipping_address jsonb := '{}'::jsonb;
  v_new_shipping_address jsonb := '{}'::jsonb;
  v_missing_item_count integer := 0;
  v_added_item_count integer := 0;
  v_subtotal numeric := 0;
  v_shipping_fee numeric := 0;
  v_discount_amount numeric := 0;
  v_gift_wrapping_fee numeric := 0;
  v_tax_amount numeric := 0;
  v_existing_tax_subtotals jsonb := '[]'::jsonb;
  v_tax_exclusive_amount numeric := 0;
  v_tax_inclusive_amount numeric := 0;
  v_total numeric := 0;
  v_paid_amount numeric := 0;
  v_product_id uuid;
  v_manage_stock boolean;
  v_vat_registration_status text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_order_source text;
  v_shipping_address_line text;
  v_shipping_city text;
  v_shipping_name text;
  v_shipping_phone text;
  v_shipping_state text;
  v_notify_customer boolean := false;
  v_changed_fields text[] := ARRAY[]::text[];
  v_change_category text := 'financial';
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT
    o.amount_paid,
    o.branch_id,
    o.customer_email,
    o.customer_id,
    o.customer_name,
    o.customer_phone,
    o.discount_amount,
    o.gift_wrapping_fee,
    o.merchant_id,
    o.notes,
    o.payment_status,
    o.shipping_address,
    o.shipping_fee,
    o.shipping_status,
    o.source,
    o.subtotal,
    o.tax_basis,
    o.tax_amount,
    o.tax_exclusive_amount,
    o.tax_inclusive_amount,
    o.total,
    o.wallet_amount_used
    INTO v_order
  FROM public.orders AS o
  JOIN public.merchants AS m ON m.id = o.merchant_id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT m.vat_registration_status
    INTO v_vat_registration_status
  FROM public.merchants AS m
  WHERE m.id = v_order.merchant_id
  FOR UPDATE;

  IF NOT (
    v_order.merchant_id IN (
      SELECT m.id
      FROM public.merchants m
      WHERE m.user_id = v_actor
    )
    OR public.check_staff_permission(v_actor, v_order.merchant_id, 'orders', 'edit')
  ) THEN
    RAISE EXCEPTION 'order_edit_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'order_items_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_payload -> 'customer'), '') <> 'object'
    OR COALESCE(jsonb_typeof(p_payload -> 'shipping_address'), '') <> 'object'
  THEN
    RAISE EXCEPTION 'order_required_fields_invalid' USING ERRCODE = '22023';
  END IF;

  v_customer_name := NULLIF(btrim(p_payload #>> '{customer,name}'), '');
  v_customer_email := NULLIF(btrim(p_payload #>> '{customer,email}'), '');
  v_customer_phone := NULLIF(btrim(p_payload #>> '{customer,phone}'), '');
  v_order_source := NULLIF(btrim(p_payload ->> 'source'), '');
  v_shipping_address_line := COALESCE(
    NULLIF(btrim(p_payload #>> '{shipping_address,address}'), ''),
    ''
  );
  v_shipping_city := NULLIF(btrim(p_payload #>> '{shipping_address,city}'), '');
  v_shipping_name := NULLIF(btrim(p_payload #>> '{shipping_address,name}'), '');
  v_shipping_phone := COALESCE(
    NULLIF(btrim(p_payload #>> '{shipping_address,phone}'), ''),
    v_customer_phone,
    ''
  );
  v_shipping_state := NULLIF(btrim(p_payload #>> '{shipping_address,state}'), '');

  IF v_customer_name IS NULL OR v_shipping_name IS NULL THEN
    RAISE EXCEPTION 'order_required_fields_invalid' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'notify_customer'
    AND p_payload -> 'notify_customer' <> 'null'::jsonb
    AND jsonb_typeof(p_payload -> 'notify_customer') <> 'boolean'
  THEN
    RAISE EXCEPTION 'order_notify_customer_invalid' USING ERRCODE = '22023';
  END IF;

  v_notify_customer := COALESCE((p_payload ->> 'notify_customer')::boolean, false);

  IF jsonb_typeof(p_payload -> 'shipping_fee') <> 'number'
    OR jsonb_typeof(p_payload -> 'discount_amount') <> 'number'
    OR jsonb_typeof(p_payload -> 'tax_amount') <> 'number'
    OR (p_payload ? 'gift_wrapping_fee'
      AND p_payload -> 'gift_wrapping_fee' <> 'null'::jsonb
      AND jsonb_typeof(p_payload -> 'gift_wrapping_fee') <> 'number')
    OR (p_payload ->> 'shipping_fee')::numeric < 0
    OR (p_payload ->> 'discount_amount')::numeric < 0
    OR (p_payload ->> 'tax_amount')::numeric < 0
    OR (p_payload ? 'gift_wrapping_fee'
      AND p_payload -> 'gift_wrapping_fee' <> 'null'::jsonb
      AND (p_payload ->> 'gift_wrapping_fee')::numeric < 0)
  THEN
    RAISE EXCEPTION 'order_money_invalid' USING ERRCODE = '22023';
  END IF;

  v_shipping_fee := (p_payload ->> 'shipping_fee')::numeric;
  v_discount_amount := (p_payload ->> 'discount_amount')::numeric;
  v_tax_amount := (p_payload ->> 'tax_amount')::numeric;
  v_gift_wrapping_fee := COALESCE(
    (p_payload ->> 'gift_wrapping_fee')::numeric,
    COALESCE(v_order.gift_wrapping_fee, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(btrim(item ->> 'name'), '') IS NULL
      OR jsonb_typeof(item -> 'price') <> 'number'
      OR (item ->> 'price')::numeric < 0
      OR jsonb_typeof(item -> 'quantity') <> 'number'
      OR (item ->> 'quantity')::numeric <> trunc((item ->> 'quantity')::numeric)
      OR (item ->> 'quantity')::numeric < 1
      OR (item ->> 'quantity')::numeric > 999
      OR COALESCE(
        NULLIF(item ->> 'product_match_status', ''),
        CASE
          WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
          ELSE 'linked'
        END
      ) NOT IN ('custom', 'linked', 'unreviewed')
  ) THEN
    RAISE EXCEPTION 'order_item_values_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_order.shipping_status IN ('cancelled', 'returned') THEN
    RAISE EXCEPTION 'order_terminal_not_editable' USING ERRCODE = '23514';
  END IF;

  IF NULLIF(p_payload ->> 'branch_id', '') IS NOT NULL
    AND NOT ((p_payload ->> 'branch_id') ~* v_uuid_pattern)
  THEN
    RAISE EXCEPTION 'branch_id_invalid' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(p_payload #>> '{customer,id}', '') IS NOT NULL
    AND NOT ((p_payload #>> '{customer,id}') ~* v_uuid_pattern)
  THEN
    RAISE EXCEPTION 'customer_id_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'product_id', '') IS NOT NULL
      AND NOT ((item ->> 'product_id') ~* v_uuid_pattern)
  ) THEN
    RAISE EXCEPTION 'order_item_product_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'variant_id', '') IS NOT NULL
      AND NOT ((item ->> 'variant_id') ~* v_uuid_pattern)
  ) THEN
    RAISE EXCEPTION 'order_item_variant_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'variant_id', oi.variant_id,
        'variant_name', NULLIF(btrim(oi.variant_name), ''),
        'name', btrim(oi.name),
        'quantity', oi.quantity,
        'price', oi.price,
        'condition', NULLIF(btrim(oi.condition), ''),
        'image_url', NULLIF(btrim(oi.image_url), ''),
        'item_description', NULLIF(btrim(oi.item_description), ''),
        'variant_attributes', CASE
          WHEN jsonb_typeof(COALESCE(oi.variant_attributes, '{}'::jsonb)) = 'object'
            THEN COALESCE(oi.variant_attributes, '{}'::jsonb)
          ELSE '{}'::jsonb
        END,
        'product_match_status', COALESCE(
          NULLIF(btrim(oi.product_match_status), ''),
          CASE WHEN oi.product_id IS NULL THEN 'custom' ELSE 'linked' END
        )
      )
      ORDER BY oi.product_id,
        oi.variant_id,
        NULLIF(btrim(oi.variant_name), ''),
        btrim(oi.name),
        oi.price,
        oi.quantity,
        NULLIF(btrim(oi.condition), ''),
        NULLIF(btrim(oi.image_url), ''),
        NULLIF(btrim(oi.item_description), ''),
        CASE
          WHEN jsonb_typeof(COALESCE(oi.variant_attributes, '{}'::jsonb)) = 'object'
            THEN COALESCE(oi.variant_attributes, '{}'::jsonb)::text
          ELSE '{}'::jsonb::text
        END,
        COALESCE(
          NULLIF(btrim(oi.product_match_status), ''),
          CASE WHEN oi.product_id IS NULL THEN 'custom' ELSE 'linked' END
        )
    ),
    '[]'::jsonb
  )
    INTO v_existing_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', NULLIF(item ->> 'product_id', '')::uuid,
        'variant_id', NULLIF(item ->> 'variant_id', '')::uuid,
        'variant_name', NULLIF(btrim(item ->> 'variant_name'), ''),
        'name', btrim(item ->> 'name'),
        'quantity', (item ->> 'quantity')::integer,
        'price', (item ->> 'price')::numeric,
        'condition', NULLIF(btrim(item ->> 'condition'), ''),
        'image_url', NULLIF(btrim(item ->> 'image_url'), ''),
        'item_description', NULLIF(btrim(item ->> 'item_description'), ''),
        'variant_attributes', CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN item -> 'variant_attributes'
          ELSE '{}'::jsonb
        END,
        'product_match_status', COALESCE(
          NULLIF(btrim(item ->> 'product_match_status'), ''),
          CASE
            WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
            ELSE 'linked'
          END
        )
      )
      ORDER BY NULLIF(item ->> 'product_id', '')::uuid,
        NULLIF(item ->> 'variant_id', '')::uuid,
        NULLIF(btrim(item ->> 'variant_name'), ''),
        btrim(item ->> 'name'),
        (item ->> 'price')::numeric,
        (item ->> 'quantity')::integer,
        NULLIF(btrim(item ->> 'condition'), ''),
        NULLIF(btrim(item ->> 'image_url'), ''),
        NULLIF(btrim(item ->> 'item_description'), ''),
        CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN (item -> 'variant_attributes')::text
          ELSE '{}'::jsonb::text
        END,
        COALESCE(
          NULLIF(btrim(item ->> 'product_match_status'), ''),
          CASE
            WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
            ELSE 'linked'
          END
        )
    ),
    '[]'::jsonb
  )
    INTO v_new_items
  FROM jsonb_array_elements(v_items) AS item;

  SELECT COUNT(*)::integer
    INTO v_missing_item_count
  FROM (
    SELECT item
    FROM jsonb_array_elements(v_existing_items) AS existing_item(item)
    EXCEPT ALL
    SELECT item
    FROM jsonb_array_elements(v_new_items) AS new_item(item)
  ) AS missing_items;

  SELECT COUNT(*)::integer
    INTO v_added_item_count
  FROM (
    SELECT item
    FROM jsonb_array_elements(v_new_items) AS new_item(item)
    EXCEPT ALL
    SELECT item
    FROM jsonb_array_elements(v_existing_items) AS existing_item(item)
  ) AS added_items;

  IF v_missing_item_count > 0 OR v_added_item_count < 1 THEN
    RAISE EXCEPTION 'order_item_append_requires_existing_lines_unchanged'
      USING ERRCODE = '23514';
  END IF;

  IF v_added_item_count > 1 THEN
    RAISE EXCEPTION 'order_item_append_supports_one_new_line'
      USING ERRCODE = '23514';
  END IF;

  SELECT item
    INTO v_added_item
  FROM (
    SELECT item
    FROM jsonb_array_elements(v_new_items) AS new_item(item)
    EXCEPT ALL
    SELECT item
    FROM jsonb_array_elements(v_existing_items) AS existing_item(item)
  ) AS added_item
  LIMIT 1;

  IF NULLIF(p_payload ->> 'branch_id', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = (p_payload ->> 'branch_id')::uuid
        AND b.merchant_id = v_order.merchant_id
    )
  THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = '23503';
  END IF;

  IF NULLIF(p_payload #>> '{customer,id}', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = (p_payload #>> '{customer,id}')::uuid
        AND c.merchant_id = v_order.merchant_id
    )
  THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = '23503';
  END IF;

  IF NULLIF(v_added_item ->> 'product_id', '') IS NULL
    AND COALESCE(
      NULLIF(v_added_item ->> 'product_match_status', ''),
      'custom'
    ) <> 'custom'
  THEN
    RAISE EXCEPTION 'order_item_product_required' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'product_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = (item ->> 'product_id')::uuid
          AND p.merchant_id = v_order.merchant_id
      )
  ) THEN
    RAISE EXCEPTION 'order_item_product_forbidden' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'variant_id', '') IS NOT NULL
      AND (
        NULLIF(item ->> 'product_id', '') IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.product_variants pv
          WHERE pv.id = (item ->> 'variant_id')::uuid
            AND pv.product_id = (item ->> 'product_id')::uuid
            AND pv.merchant_id = v_order.merchant_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'order_item_variant_forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_product_id, v_manage_stock IN
    SELECT p.id, COALESCE(p.manage_stock, true)
    FROM public.products AS p
    WHERE p.id = NULLIF(v_added_item ->> 'product_id', '')::uuid
      AND p.merchant_id = v_order.merchant_id
    FOR UPDATE OF p
  LOOP
    IF v_manage_stock THEN
      RAISE EXCEPTION 'order_item_replacement_has_managed_stock'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  SELECT GREATEST(
    COALESCE(v_order.amount_paid, 0),
    COALESCE(SUM(t.amount), 0)
  )
    INTO v_paid_amount
  FROM public.transactions t
  WHERE t.order_id = p_order_id
    AND t.status IN ('success', 'completed');

  IF v_paid_amount > 0
    OR COALESCE(v_order.wallet_amount_used, 0) > 0
    OR v_order.payment_status IN ('paid', 'partially_paid', 'bnpl_approved', 'refunded')
  THEN
    RAISE EXCEPTION 'order_financial_edit_has_payments' USING ERRCODE = '23514';
  END IF;

  IF v_order.shipping_status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'order_financial_edit_after_fulfillment' USING ERRCODE = '23514';
  END IF;

  v_existing_shipping_address := COALESCE(v_order.shipping_address, '{}'::jsonb);
  v_new_shipping_address := jsonb_strip_nulls(
    v_existing_shipping_address || jsonb_build_object(
      'address', v_shipping_address_line,
      'city', v_shipping_city,
      'name', v_shipping_name,
      'phone', v_shipping_phone,
      'state', v_shipping_state
    )
  );

  v_before := jsonb_build_object(
    'branch_id', v_order.branch_id,
    'customer_id', v_order.customer_id,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'shipping_address', v_existing_shipping_address,
    'source', v_order.source,
    'notes', v_order.notes,
    'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_order.tax_amount,
    'tax_exclusive_amount', v_order.tax_exclusive_amount,
    'tax_inclusive_amount', v_order.tax_inclusive_amount,
    'gift_wrapping_fee', v_order.gift_wrapping_fee,
    'discount_amount', v_order.discount_amount,
    'total', v_order.total,
    'items', v_existing_items
  );

  UPDATE public.orders
  SET
    branch_id = CASE
      WHEN p_payload ? 'branch_id'
        THEN NULLIF(p_payload ->> 'branch_id', '')::uuid
      ELSE v_order.branch_id
    END,
    customer_id = CASE
      WHEN (p_payload -> 'customer') ? 'id'
        THEN NULLIF(p_payload #>> '{customer,id}', '')::uuid
      ELSE v_order.customer_id
    END,
    customer_name = v_customer_name,
    customer_email = v_customer_email,
    customer_phone = v_customer_phone,
    shipping_address = v_new_shipping_address,
    source = CASE
      WHEN p_payload ? 'source' THEN v_order_source
      ELSE v_order.source
    END,
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(p_payload ->> 'notes', '')
      ELSE v_order.notes
    END,
    shipping_fee = v_shipping_fee,
    gift_wrapping_fee = v_gift_wrapping_fee,
    discount_amount = v_discount_amount,
    updated_at = now()
  WHERE id = p_order_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vat_category_code', ots.vat_category_code,
        'vat_rate', ots.vat_rate,
        'taxable_amount', ots.taxable_amount,
        'exemption_reason', ots.exemption_reason,
        'exemption_reason_code', ots.exemption_reason_code
      )
      ORDER BY ots.vat_category_code, ots.vat_rate
    ),
    '[]'::jsonb
  )
    INTO v_existing_tax_subtotals
  FROM public.order_tax_subtotals AS ots
  WHERE ots.order_id = p_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    variant_id,
    variant_name,
    name,
    quantity,
    price,
    condition,
    image_url,
    item_description,
    variant_attributes,
    product_match_status,
    line_extension_amount
  ) VALUES (
    p_order_id,
    NULLIF(v_added_item ->> 'product_id', '')::uuid,
    NULLIF(v_added_item ->> 'variant_id', '')::uuid,
    NULLIF(v_added_item ->> 'variant_name', ''),
    btrim(v_added_item ->> 'name'),
    (v_added_item ->> 'quantity')::integer,
    (v_added_item ->> 'price')::numeric,
    NULLIF(v_added_item ->> 'condition', ''),
    NULLIF(v_added_item ->> 'image_url', ''),
    NULLIF(v_added_item ->> 'item_description', ''),
    CASE
      WHEN jsonb_typeof(v_added_item -> 'variant_attributes') = 'object'
        THEN v_added_item -> 'variant_attributes'
      ELSE '{}'::jsonb
    END,
    COALESCE(
      NULLIF(v_added_item ->> 'product_match_status', ''),
      CASE
        WHEN NULLIF(v_added_item ->> 'product_id', '') IS NULL THEN 'custom'
        ELSE 'linked'
      END
    ),
    ROUND(
      (v_added_item ->> 'price')::numeric * (v_added_item ->> 'quantity')::integer,
      2
    )
  );

  SELECT
    COALESCE(
      SUM(COALESCE(oi.line_extension_amount, ROUND(oi.quantity * oi.price, 2))),
      0
    )
    INTO v_subtotal
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  v_tax_exclusive_amount := v_subtotal;
  v_tax_inclusive_amount := v_subtotal + v_tax_amount;
  v_total := CASE
    WHEN COALESCE(v_order.tax_basis, 'exclusive') = 'inclusive' THEN
      v_subtotal - v_discount_amount + v_gift_wrapping_fee + v_shipping_fee
    ELSE
      v_subtotal - v_discount_amount + v_gift_wrapping_fee + v_shipping_fee + v_tax_amount
  END;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'order_total_negative' USING ERRCODE = '23514';
  END IF;

  UPDATE public.orders
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    tax_exclusive_amount = v_tax_exclusive_amount,
    tax_inclusive_amount = v_tax_inclusive_amount,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;

  IF v_vat_registration_status = 'registered' THEN
    DELETE FROM public.order_tax_subtotals
    WHERE order_id = p_order_id;

    WITH item_tax AS (
      SELECT
        COALESCE(NULLIF(oi.vat_category_code, ''), 'S') AS vat_category_code,
        COALESCE(oi.vat_rate, 7.5) AS vat_rate,
        COALESCE(
          oi.line_extension_amount,
          ROUND(oi.quantity * oi.price, 2)
        ) AS taxable_amount,
        CASE
          WHEN COALESCE(NULLIF(oi.vat_category_code, ''), 'S') = 'S'
            AND COALESCE(oi.vat_rate, 7.5) > 0
          THEN ROUND(
            COALESCE(
              oi.line_extension_amount,
              ROUND(oi.quantity * oi.price, 2)
            ) * COALESCE(oi.vat_rate, 7.5) / 100,
            2
          )
          ELSE 0
        END AS tax_weight
      FROM public.order_items AS oi
      WHERE oi.order_id = p_order_id
    ),
    grouped_taxable AS (
      SELECT
        it.vat_category_code,
        it.vat_rate,
        COALESCE(SUM(it.taxable_amount), 0) AS taxable_amount,
        COALESCE(SUM(it.tax_weight), 0) AS tax_weight
      FROM item_tax AS it
      GROUP BY
        it.vat_category_code,
        it.vat_rate
    ),
    existing_tax_metadata AS (
      SELECT
        metadata.vat_category_code,
        metadata.vat_rate,
        metadata.taxable_amount,
        metadata.exemption_reason,
        metadata.exemption_reason_code
      FROM jsonb_to_recordset(v_existing_tax_subtotals) AS metadata(
        vat_category_code text,
        vat_rate numeric,
        taxable_amount numeric,
        exemption_reason text,
        exemption_reason_code text
      )
    ),
    allocated_tax AS (
      SELECT
        gt.vat_category_code,
        gt.vat_rate,
        gt.taxable_amount,
        gt.tax_weight,
        SUM(gt.tax_weight) OVER () AS total_tax_weight,
        ROW_NUMBER() OVER (
          ORDER BY gt.vat_category_code, gt.vat_rate
        ) AS group_row_number,
        COUNT(*) OVER () AS group_row_count,
        SUM(CASE WHEN gt.tax_weight > 0 THEN 1 ELSE 0 END) OVER (
          ORDER BY gt.vat_category_code, gt.vat_rate
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS allocation_row_number,
        SUM(CASE WHEN gt.tax_weight > 0 THEN 1 ELSE 0 END) OVER () AS allocation_row_count
      FROM grouped_taxable gt
    ),
    balanced_tax AS (
      SELECT
        allocated.vat_category_code,
        allocated.vat_rate,
        allocated.taxable_amount,
        metadata.exemption_reason,
        metadata.exemption_reason_code,
        CASE
          WHEN allocated.total_tax_weight = 0
            THEN CASE
              WHEN allocated.group_row_number = allocated.group_row_count THEN v_tax_amount
              ELSE 0
            END
          WHEN allocated.tax_weight <= 0 THEN 0
          WHEN allocated.allocation_row_count = 1 THEN v_tax_amount
          WHEN allocated.allocation_row_number = allocated.allocation_row_count THEN
            v_tax_amount - COALESCE(
              SUM(ROUND(v_tax_amount * allocated.tax_weight / allocated.total_tax_weight, 2))
                OVER (
                  ORDER BY allocated.allocation_row_number
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
              0
            )
          ELSE ROUND(v_tax_amount * allocated.tax_weight / allocated.total_tax_weight, 2)
        END AS allocated_tax_amount
      FROM allocated_tax AS allocated
      LEFT JOIN existing_tax_metadata AS metadata
        ON metadata.vat_category_code = allocated.vat_category_code
        AND metadata.vat_rate = allocated.vat_rate
    )
    INSERT INTO public.order_tax_subtotals (
      order_id,
      vat_category_code,
      vat_rate,
      taxable_amount,
      tax_amount,
      exemption_reason,
      exemption_reason_code
    )
    SELECT
      p_order_id,
      bt.vat_category_code,
      bt.vat_rate,
      bt.taxable_amount,
      bt.allocated_tax_amount,
      bt.exemption_reason,
      bt.exemption_reason_code
    FROM balanced_tax bt;
  ELSE
    WITH grouped_taxable AS (
      SELECT
        COALESCE(NULLIF(oi.vat_category_code, ''), 'S') AS vat_category_code,
        COALESCE(oi.vat_rate, 7.5) AS vat_rate,
        COALESCE(
          SUM(
            COALESCE(
              oi.line_extension_amount,
              ROUND(oi.quantity * oi.price, 2)
            )
          ),
          0
        ) AS taxable_amount
      FROM public.order_items AS oi
      WHERE oi.order_id = p_order_id
      GROUP BY
        COALESCE(NULLIF(oi.vat_category_code, ''), 'S'),
        COALESCE(oi.vat_rate, 7.5)
    ),
    existing_tax_metadata AS (
      SELECT
        metadata.vat_category_code,
        metadata.vat_rate,
        metadata.taxable_amount,
        metadata.exemption_reason,
        metadata.exemption_reason_code
      FROM jsonb_to_recordset(v_existing_tax_subtotals) AS metadata(
        vat_category_code text,
        vat_rate numeric,
        taxable_amount numeric,
        exemption_reason text,
        exemption_reason_code text
      )
    ),
    rebuilt_tax AS (
      SELECT
        COALESCE(gt.vat_category_code, metadata.vat_category_code)
          AS vat_category_code,
        COALESCE(gt.vat_rate, metadata.vat_rate) AS vat_rate,
        COALESCE(gt.taxable_amount, metadata.taxable_amount, 0)
          AS taxable_amount,
        metadata.exemption_reason,
        metadata.exemption_reason_code
      FROM grouped_taxable AS gt
      FULL OUTER JOIN existing_tax_metadata AS metadata
        ON metadata.vat_category_code = gt.vat_category_code
        AND metadata.vat_rate = gt.vat_rate
    )
    INSERT INTO public.order_tax_subtotals AS existing_tax_subtotal (
      order_id,
      vat_category_code,
      vat_rate,
      taxable_amount,
      tax_amount,
      exemption_reason,
      exemption_reason_code
    )
    SELECT
      p_order_id,
      rt.vat_category_code,
      rt.vat_rate,
      rt.taxable_amount,
      0,
      rt.exemption_reason,
      rt.exemption_reason_code
    FROM rebuilt_tax AS rt
    ON CONFLICT (order_id, vat_category_code, vat_rate) DO UPDATE
    SET
      taxable_amount = EXCLUDED.taxable_amount,
      tax_amount = EXCLUDED.tax_amount,
      exemption_reason = COALESCE(
        EXCLUDED.exemption_reason,
        existing_tax_subtotal.exemption_reason
      ),
      exemption_reason_code = COALESCE(
        EXCLUDED.exemption_reason_code,
        existing_tax_subtotal.exemption_reason_code
      );
  END IF;

  SELECT
    o.amount_paid,
    o.branch_id,
    o.customer_email,
    o.customer_id,
    o.customer_name,
    o.customer_phone,
    o.discount_amount,
    o.gift_wrapping_fee,
    o.merchant_id,
    o.notes,
    o.payment_status,
    o.shipping_address,
    o.shipping_fee,
    o.shipping_status,
    o.source,
    o.subtotal,
    o.tax_basis,
    o.tax_amount,
    o.tax_exclusive_amount,
    o.tax_inclusive_amount,
    o.total,
    o.wallet_amount_used
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id;

  v_after := jsonb_build_object(
    'branch_id', v_order.branch_id,
    'customer_id', v_order.customer_id,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'shipping_address', v_new_shipping_address,
    'source', v_order.source,
    'notes', v_order.notes,
    'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_order.tax_amount,
    'tax_exclusive_amount', v_order.tax_exclusive_amount,
    'tax_inclusive_amount', v_order.tax_inclusive_amount,
    'gift_wrapping_fee', v_order.gift_wrapping_fee,
    'discount_amount', v_order.discount_amount,
    'total', v_order.total,
    'items', v_new_items
  );

  SELECT ARRAY_AGG(key ORDER BY key)
    INTO v_changed_fields
  FROM jsonb_each(v_before) before_entry(key, value)
  JOIN jsonb_each(v_after) after_entry USING (key)
  WHERE before_entry.value IS DISTINCT FROM after_entry.value;

  v_changed_fields := COALESCE(v_changed_fields, ARRAY[]::text[]);

  IF v_changed_fields && ARRAY[
    'items',
    'subtotal',
    'shipping_fee',
    'gift_wrapping_fee',
    'tax_amount',
    'tax_exclusive_amount',
    'tax_inclusive_amount',
    'discount_amount',
    'total'
  ]::text[] THEN
    v_change_category := 'financial';
  ELSIF v_changed_fields && ARRAY[
    'customer_id',
    'customer_name',
    'customer_email',
    'customer_phone',
    'shipping_address'
  ]::text[] THEN
    v_change_category := 'customer_visible';
  ELSE
    v_change_category := 'internal';
  END IF;

  INSERT INTO public.order_audit_events (
    merchant_id,
    order_id,
    actor_user_id,
    action,
    change_category,
    changed_fields,
    before_snapshot,
    after_snapshot,
    metadata
  ) VALUES (
    v_order.merchant_id,
    p_order_id,
    v_actor,
    'order.update',
    v_change_category,
    v_changed_fields,
    v_before,
    v_after,
    jsonb_build_object(
      'change_category', v_change_category,
      'notify_customer', v_notify_customer,
      'operation', 'append_order_items'
    )
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'merchant_id', v_order.merchant_id,
    'customer_email', v_after ->> 'customer_email',
    'changed_fields', to_jsonb(v_changed_fields),
    'change_category', v_change_category,
    'notify_customer', v_notify_customer
  );
END;
$$;

ALTER FUNCTION public.append_admin_order_items(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_admin_order_items(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_order(
  p_order_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    RETURN public.update_admin_order_replace(p_order_id, p_payload);
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    IF SQLERRM NOT LIKE '%order_item_replacement_has_accounting_metadata%'
      AND SQLERRM NOT LIKE '%order_item_product_required%'
    THEN
      RAISE;
    END IF;
  END;

  BEGIN
    RETURN public.append_admin_order_items(p_order_id, p_payload);
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM LIKE '%order_item_append_requires_existing_lines_unchanged%' THEN
      RAISE EXCEPTION 'order_item_replacement_has_accounting_metadata'
        USING ERRCODE = '23514';
    END IF;

    IF SQLERRM LIKE '%order_item_append_supports_one_new_line%' THEN
      RAISE EXCEPTION 'order_item_append_supports_one_new_line'
        USING ERRCODE = '23514';
    END IF;

    RAISE;
  END;
END;
$$;

ALTER FUNCTION public.update_admin_order(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_admin_order_replace(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_order(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_order(uuid, jsonb)
  TO authenticated;
