CREATE TABLE IF NOT EXISTS public.order_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('order.update')),
  change_category text NOT NULL DEFAULT 'internal'
    CHECK (change_category IN ('customer_visible', 'financial', 'internal')),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_audit_events_order_created_at
  ON public.order_audit_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_audit_events_merchant_created_at
  ON public.order_audit_events (merchant_id, created_at DESC);

ALTER TABLE public.order_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.order_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_audit_events TO authenticated;
GRANT ALL ON public.order_audit_events TO service_role;

DROP POLICY IF EXISTS "order_audit_events_select_policy" ON public.order_audit_events;
CREATE POLICY "order_audit_events_select_policy"
  ON public.order_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_audit_events.order_id
        AND o.merchant_id = order_audit_events.merchant_id
        AND (
          o.merchant_id IN (
            SELECT m.id
            FROM public.merchants m
            WHERE m.user_id = (SELECT auth.uid())
          )
          OR public.check_staff_permission(
            (SELECT auth.uid()),
            o.merchant_id,
            'orders',
            'view'
          )
          OR public.check_staff_permission(
            (SELECT auth.uid()),
            o.merchant_id,
            'orders',
            'edit'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Merchants can view their variants" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_select_by_merchant_access" ON public.product_variants;
CREATE POLICY "product_variants_select_by_merchant_access"
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'orders',
      'edit'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'products',
      'view'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'products',
      'edit'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'products',
      'manage_inventory'
    )
  );

CREATE OR REPLACE FUNCTION public.update_admin_order(
  p_order_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_order record;
  v_before jsonb;
  v_after jsonb;
  v_candidate_after jsonb;
  v_items jsonb := COALESCE(p_payload -> 'items', '[]'::jsonb);
  v_subtotal numeric := 0;
  v_shipping_fee numeric := 0;
  v_discount_amount numeric := 0;
  v_gift_wrapping_fee numeric := 0;
  v_tax_basis text;
  v_tax_amount numeric := 0;
  v_tax_exclusive_amount numeric := 0;
  v_tax_inclusive_amount numeric := 0;
  v_total numeric := 0;
  v_paid_amount numeric := 0;
  v_wallet_amount numeric := 0;
  v_existing_items jsonb := '[]'::jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_existing_shipping_address jsonb := '{}'::jsonb;
  v_new_shipping_address jsonb := '{}'::jsonb;
  v_items_changed boolean := false;
  v_financial_amounts_changed boolean := false;
  v_changed_fields text[] := ARRAY[]::text[];
  v_change_category text := 'internal';
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
    o.updated_at,
    o.wallet_amount_used,
    m.vat_registration_status
    INTO v_order
  FROM public.orders AS o
  JOIN public.merchants AS m ON m.id = o.merchant_id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

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

  IF CASE
      WHEN jsonb_typeof(p_payload -> 'shipping_fee') = 'number'
        THEN (p_payload ->> 'shipping_fee')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN jsonb_typeof(p_payload -> 'discount_amount') = 'number'
        THEN (p_payload ->> 'discount_amount')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN jsonb_typeof(p_payload -> 'tax_amount') = 'number'
        THEN (p_payload ->> 'tax_amount')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN NOT (p_payload ? 'gift_wrapping_fee')
        OR p_payload -> 'gift_wrapping_fee' = 'null'::jsonb
        THEN false
      WHEN jsonb_typeof(p_payload -> 'gift_wrapping_fee') = 'number'
        THEN (p_payload ->> 'gift_wrapping_fee')::numeric < 0
      ELSE true
    END
  THEN
    RAISE EXCEPTION 'order_money_invalid' USING ERRCODE = '22023';
  END IF;

  v_shipping_fee := (p_payload ->> 'shipping_fee')::numeric;
  v_discount_amount := (p_payload ->> 'discount_amount')::numeric;
  v_tax_amount := (p_payload ->> 'tax_amount')::numeric;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(btrim(item ->> 'name'), '') IS NULL
      OR CASE
        WHEN jsonb_typeof(item -> 'price') = 'number'
          THEN (item ->> 'price')::numeric < 0
        ELSE true
      END
      OR CASE
        WHEN jsonb_typeof(item -> 'quantity') = 'number'
          THEN (item ->> 'quantity')::numeric <> trunc((item ->> 'quantity')::numeric)
            OR (item ->> 'quantity')::numeric < 1
            OR (item ->> 'quantity')::numeric > 999
        ELSE true
      END
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

  SELECT COALESCE(SUM((item ->> 'price')::numeric * (item ->> 'quantity')::integer), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(v_items) AS item;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'variant_id', oi.variant_id,
        'variant_name', oi.variant_name,
        'name', oi.name,
        'quantity', oi.quantity,
        'price', oi.price,
        'condition', oi.condition,
        'image_url', oi.image_url,
        'item_description', oi.item_description,
        'variant_attributes', COALESCE(oi.variant_attributes, '{}'::jsonb),
        'product_match_status', COALESCE(
          oi.product_match_status,
          CASE WHEN oi.product_id IS NULL THEN 'custom' ELSE 'linked' END
        )
      )
      ORDER BY oi.product_id,
        oi.variant_id,
        oi.name,
        oi.price,
        oi.quantity,
        oi.condition,
        oi.image_url,
        oi.item_description,
        COALESCE(oi.variant_attributes, '{}'::jsonb)::text,
        COALESCE(
          oi.product_match_status,
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
        'variant_name', NULLIF(item ->> 'variant_name', ''),
        'name', btrim(item ->> 'name'),
        'quantity', (item ->> 'quantity')::integer,
        'price', (item ->> 'price')::numeric,
        'condition', NULLIF(item ->> 'condition', ''),
        'image_url', NULLIF(item ->> 'image_url', ''),
        'item_description', NULLIF(item ->> 'item_description', ''),
        'variant_attributes', CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN item -> 'variant_attributes'
          ELSE '{}'::jsonb
        END,
        'product_match_status', COALESCE(
          NULLIF(item ->> 'product_match_status', ''),
          CASE
            WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
            ELSE 'linked'
          END
        )
      )
      ORDER BY NULLIF(item ->> 'product_id', '')::uuid,
        NULLIF(item ->> 'variant_id', '')::uuid,
        btrim(item ->> 'name'),
        (item ->> 'price')::numeric,
        (item ->> 'quantity')::integer,
        NULLIF(item ->> 'condition', ''),
        NULLIF(item ->> 'image_url', ''),
        NULLIF(item ->> 'item_description', ''),
        CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN (item -> 'variant_attributes')::text
          ELSE '{}'::jsonb::text
        END,
        COALESCE(
          NULLIF(item ->> 'product_match_status', ''),
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

  v_items_changed := v_existing_items IS DISTINCT FROM v_new_items;

  v_gift_wrapping_fee := COALESCE(
    (p_payload ->> 'gift_wrapping_fee')::numeric,
    COALESCE(v_order.gift_wrapping_fee, 0)
  );
  v_tax_basis := NULLIF(v_order.tax_basis, '');
  v_financial_amounts_changed :=
    v_items_changed
    OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
    OR v_shipping_fee IS DISTINCT FROM COALESCE(v_order.shipping_fee, 0)
    OR v_discount_amount IS DISTINCT FROM COALESCE(v_order.discount_amount, 0)
    OR v_gift_wrapping_fee IS DISTINCT FROM COALESCE(v_order.gift_wrapping_fee, 0)
    OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0);

  IF v_tax_basis IS NULL AND NOT v_financial_amounts_changed THEN
    v_tax_amount := COALESCE(v_order.tax_amount, 0);
    v_tax_exclusive_amount := v_order.tax_exclusive_amount;
    v_tax_inclusive_amount := v_order.tax_inclusive_amount;
    v_total := COALESCE(v_order.total, 0);
  ELSE
    IF v_items_changed
      OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
      OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
    THEN
      v_tax_exclusive_amount := v_subtotal;
      v_tax_inclusive_amount := v_subtotal + v_tax_amount;
    ELSE
      v_tax_exclusive_amount := v_order.tax_exclusive_amount;
      v_tax_inclusive_amount := v_order.tax_inclusive_amount;
    END IF;

    IF COALESCE(v_tax_basis, 'exclusive') = 'inclusive' THEN
      v_total :=
        v_subtotal -
        v_discount_amount +
        v_gift_wrapping_fee +
        v_shipping_fee;
    ELSE
      v_total :=
        v_subtotal -
        v_discount_amount +
        v_gift_wrapping_fee +
        v_shipping_fee +
        v_tax_amount;
    END IF;
  END IF;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'order_total_negative' USING ERRCODE = '23514';
  END IF;

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

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'product_id', '') IS NULL
      AND COALESCE(
        NULLIF(item ->> 'product_match_status', ''),
        CASE
          WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
          ELSE 'linked'
        END
      ) <> 'custom'
  ) THEN
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

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_items) AS item
      JOIN public.products p ON p.id = NULLIF(item ->> 'product_id', '')::uuid
      WHERE NULLIF(item ->> 'product_id', '') IS NOT NULL
        AND p.merchant_id = v_order.merchant_id
        AND COALESCE(p.manage_stock, true)
    )
  THEN
    RAISE EXCEPTION 'order_item_replacement_has_managed_stock'
      USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND (
          oi.fulfillment_data IS NOT NULL
          OR COALESCE(oi.has_assurance, false)
          OR COALESCE(oi.assurance_fee, 0) > 0
        )
    )
  THEN
    RAISE EXCEPTION 'order_item_replacement_has_historical_state' USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND (
          oi.cost_price IS NOT NULL
          OR NULLIF(btrim(oi.supplier_name), '') IS NOT NULL
          OR oi.quiz_award_id IS NOT NULL
          OR COALESCE(oi.unit_code, 'EA') <> 'EA'
          OR COALESCE(oi.vat_category_code, 'S') <> 'S'
          OR COALESCE(oi.vat_rate, 7.5) <> 7.5
          OR COALESCE(oi.vat_amount, 0) <> 0
          OR NULLIF(btrim(oi.sellers_item_id), '') IS NOT NULL
        )
    )
  THEN
    RAISE EXCEPTION 'order_item_replacement_has_accounting_metadata'
      USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id
        AND COALESCE(p.manage_stock, true)
    )
  THEN
    RAISE EXCEPTION 'order_item_replacement_has_managed_stock'
      USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.variant_inventory vi ON vi.order_item_id = oi.id
      WHERE oi.order_id = p_order_id
    )
  THEN
    RAISE EXCEPTION 'order_item_replacement_has_serialized_reservations'
      USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.variant_inventory vi ON vi.order_item_id = oi.id
      WHERE oi.order_id = p_order_id
        AND (
          vi.status <> 'reserved'
          OR vi.reservation_expires_at IS NULL
        )
    )
  THEN
    RAISE EXCEPTION 'cannot_delete_order_item_with_historical_serialized_units'
      USING ERRCODE = '23514';
  END IF;

  IF v_items_changed
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN private.variant_inventory_events vie ON vie.order_item_id = oi.id
      WHERE oi.order_id = p_order_id
        AND vie.event_type NOT IN (
          'reserved',
          'reservation_released',
          'reservation_expired'
        )
    )
  THEN
    RAISE EXCEPTION 'cannot_delete_order_item_with_historical_inventory_events'
      USING ERRCODE = '23514';
  END IF;

  SELECT GREATEST(
    COALESCE(v_order.amount_paid, 0),
    COALESCE(SUM(t.amount), 0)
  )
    INTO v_paid_amount
  FROM public.transactions t
  WHERE t.order_id = p_order_id
    AND t.status IN ('success', 'completed');

  v_wallet_amount := COALESCE(v_order.wallet_amount_used, 0);

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

  IF v_paid_amount > 0
    OR v_wallet_amount > 0
    OR v_order.payment_status IN ('paid', 'partially_paid', 'bnpl_approved', 'refunded')
  THEN
    IF v_items_changed
      OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
      OR v_shipping_fee IS DISTINCT FROM COALESCE(v_order.shipping_fee, 0)
      OR v_gift_wrapping_fee IS DISTINCT FROM COALESCE(v_order.gift_wrapping_fee, 0)
      OR v_discount_amount IS DISTINCT FROM COALESCE(v_order.discount_amount, 0)
      OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
      OR v_total IS DISTINCT FROM COALESCE(v_order.total, 0)
    THEN
      RAISE EXCEPTION 'order_financial_edit_has_payments' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_order.shipping_status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    IF v_items_changed
      OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
      OR v_shipping_fee IS DISTINCT FROM COALESCE(v_order.shipping_fee, 0)
      OR v_gift_wrapping_fee IS DISTINCT FROM COALESCE(v_order.gift_wrapping_fee, 0)
      OR v_discount_amount IS DISTINCT FROM COALESCE(v_order.discount_amount, 0)
      OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
      OR v_total IS DISTINCT FROM COALESCE(v_order.total, 0)
    THEN
      RAISE EXCEPTION 'order_financial_edit_after_fulfillment' USING ERRCODE = '23514';
    END IF;
  END IF;

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

  v_candidate_after := jsonb_build_object(
    'branch_id', NULLIF(p_payload ->> 'branch_id', '')::uuid,
    'customer_id', NULLIF(p_payload #>> '{customer,id}', '')::uuid,
    'customer_name', v_customer_name,
    'customer_email', v_customer_email,
    'customer_phone', v_customer_phone,
    'shipping_address', v_new_shipping_address,
    'source', v_order_source,
    'notes', NULLIF(p_payload ->> 'notes', ''),
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_tax_amount,
    'tax_exclusive_amount', v_tax_exclusive_amount,
    'tax_inclusive_amount', v_tax_inclusive_amount,
    'gift_wrapping_fee', v_gift_wrapping_fee,
    'discount_amount', v_discount_amount,
    'total', v_total,
    'items', v_new_items
  );

  SELECT ARRAY_AGG(key ORDER BY key)
    INTO v_changed_fields
  FROM jsonb_each(v_before) before_entry(key, value)
  JOIN jsonb_each(v_candidate_after) after_entry USING (key)
  WHERE before_entry.value IS DISTINCT FROM after_entry.value;

  v_changed_fields := COALESCE(v_changed_fields, ARRAY[]::text[]);

  IF cardinality(v_changed_fields) = 0 THEN
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'merchant_id', v_order.merchant_id,
      'customer_email', v_order.customer_email,
      'changed_fields', '[]'::jsonb,
      'change_category', 'none',
      'notify_customer', false
    );
  END IF;

  UPDATE public.orders
  SET
    branch_id = NULLIF(p_payload ->> 'branch_id', '')::uuid,
    customer_id = NULLIF(p_payload #>> '{customer,id}', '')::uuid,
    customer_name = v_customer_name,
    customer_email = v_customer_email,
    customer_phone = v_customer_phone,
    shipping_address = v_new_shipping_address,
    source = v_order_source,
    notes = NULLIF(p_payload ->> 'notes', ''),
    subtotal = v_subtotal,
    shipping_fee = v_shipping_fee,
    gift_wrapping_fee = v_gift_wrapping_fee,
    tax_amount = v_tax_amount,
    tax_exclusive_amount = v_tax_exclusive_amount,
    tax_inclusive_amount = v_tax_inclusive_amount,
    discount_amount = v_discount_amount,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;

  IF NOT v_items_changed
    AND (
      v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
      OR v_tax_exclusive_amount IS DISTINCT FROM v_order.tax_exclusive_amount
      OR v_tax_inclusive_amount IS DISTINCT FROM v_order.tax_inclusive_amount
    )
  THEN
    DELETE FROM public.order_tax_subtotals
    WHERE order_id = p_order_id;

    IF v_order.vat_registration_status = 'registered' THEN
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
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
        GROUP BY
          COALESCE(NULLIF(oi.vat_category_code, ''), 'S'),
          COALESCE(oi.vat_rate, 7.5)
      ),
      allocated_tax AS (
        SELECT
          gt.vat_category_code,
          gt.vat_rate,
          gt.taxable_amount,
          SUM(gt.taxable_amount) OVER () AS total_taxable_amount,
          ROW_NUMBER() OVER (ORDER BY gt.vat_category_code, gt.vat_rate) AS allocation_row_number,
          COUNT(*) OVER () AS allocation_row_count
        FROM grouped_taxable gt
      ),
      balanced_tax AS (
        SELECT
          allocated.vat_category_code,
          allocated.vat_rate,
          allocated.taxable_amount,
          CASE
            WHEN allocated.allocation_row_count = 1 THEN v_tax_amount
            WHEN allocated.total_taxable_amount = 0
              THEN CASE
                WHEN allocated.allocation_row_number = allocated.allocation_row_count THEN v_tax_amount
                ELSE 0
              END
            WHEN allocated.allocation_row_number = allocated.allocation_row_count THEN
              v_tax_amount - COALESCE(
                SUM(ROUND(v_tax_amount * allocated.taxable_amount / allocated.total_taxable_amount, 2))
                  OVER (
                    ORDER BY allocated.allocation_row_number
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                  ),
                0
              )
            ELSE ROUND(v_tax_amount * allocated.taxable_amount / allocated.total_taxable_amount, 2)
          END AS allocated_tax_amount
        FROM allocated_tax allocated
      )
      INSERT INTO public.order_tax_subtotals (
        order_id,
        vat_category_code,
        vat_rate,
        taxable_amount,
        tax_amount
      )
      SELECT
        p_order_id,
        bt.vat_category_code,
        bt.vat_rate,
        bt.taxable_amount,
        bt.allocated_tax_amount
      FROM balanced_tax bt;
    END IF;
  END IF;

  IF v_items_changed THEN
    DELETE FROM public.order_items
    WHERE order_id = p_order_id;

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
    )
    SELECT
      p_order_id,
      NULLIF(item ->> 'product_id', '')::uuid,
      NULLIF(item ->> 'variant_id', '')::uuid,
      NULLIF(item ->> 'variant_name', ''),
      btrim(item ->> 'name'),
      (item ->> 'quantity')::integer,
      (item ->> 'price')::numeric,
      NULLIF(item ->> 'condition', ''),
      NULLIF(item ->> 'image_url', ''),
      NULLIF(item ->> 'item_description', ''),
      CASE
        WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
          THEN item -> 'variant_attributes'
        ELSE '{}'::jsonb
      END,
      COALESCE(
        NULLIF(item ->> 'product_match_status', ''),
        CASE
          WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
          ELSE 'linked'
        END
      ),
      (item ->> 'price')::numeric * (item ->> 'quantity')::integer
    FROM jsonb_array_elements(v_items) AS item;
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
    o.updated_at,
    o.wallet_amount_used,
    m.vat_registration_status
    INTO v_order
  FROM public.orders AS o
  JOIN public.merchants AS m ON m.id = o.merchant_id
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
  v_change_category := 'internal';

  IF v_changed_fields && ARRAY['items', 'subtotal', 'shipping_fee', 'gift_wrapping_fee', 'tax_amount', 'tax_exclusive_amount', 'tax_inclusive_amount', 'discount_amount', 'total']::text[] THEN
    v_change_category := 'financial';
  ELSIF v_changed_fields && ARRAY['customer_id', 'customer_name', 'customer_email', 'customer_phone', 'shipping_address']::text[] THEN
    v_change_category := 'customer_visible';
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
      'notify_customer', v_notify_customer
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

ALTER FUNCTION public.update_admin_order(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_admin_order(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_order(uuid, jsonb) TO authenticated;
