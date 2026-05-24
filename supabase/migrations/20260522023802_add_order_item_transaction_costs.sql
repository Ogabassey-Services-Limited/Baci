ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS product_match_status text DEFAULT 'unreviewed' NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_cost_price_non_negative'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_cost_price_non_negative
      CHECK (cost_price IS NULL OR cost_price >= 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_product_match_status_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_match_status_check
      CHECK (product_match_status IN ('unreviewed', 'linked', 'custom'))
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.order_items.cost_price IS 'Actual cost for this sold line item. Overrides catalog cost for transaction profit.';
COMMENT ON COLUMN public.order_items.supplier_name IS 'Supplier/vendor for this sold line item. Overrides product metadata supplier/vendor for transaction review.';
COMMENT ON COLUMN public.order_items.product_match_status IS 'Review state for catalog-product reconciliation: unreviewed, linked, or custom.';

DROP POLICY IF EXISTS "Merchants can update order items for their orders"
  ON public.order_items;
DROP POLICY IF EXISTS "owners_and_order_staff_update_order_items"
  ON public.order_items;

CREATE POLICY "owners_and_order_staff_update_order_items"
  ON public.order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
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
            'edit'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
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
            'edit'
          )
        )
    )
  );

DROP FUNCTION IF EXISTS public.update_transaction_review_details(uuid, uuid, uuid, numeric, text, timestamptz);
DROP FUNCTION IF EXISTS public.update_transaction_review_details(uuid, uuid, uuid, numeric, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.update_transaction_review_details(uuid, uuid, uuid, uuid, uuid, numeric, text, timestamptz, text, boolean);

CREATE OR REPLACE FUNCTION public.update_transaction_review_details(
  p_merchant_id uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_cost_price numeric,
  p_supplier_name text,
  p_transaction_date timestamptz,
  p_client_timezone text DEFAULT NULL,
  p_update_product_default boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_item_product_id uuid;
  v_order_item_rows integer;
  v_order_item_variant_id uuid;
  v_order_rows integer;
  v_product_rows integer;
  v_supplier_name text := btrim(COALESCE(p_supplier_name, ''));
  v_transaction_time_zone text := NULLIF(
    btrim(COALESCE(p_client_timezone, '')),
    ''
  );
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Merchant is required' USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Transaction is required' USING ERRCODE = '22023';
  END IF;

  IF p_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Transaction line item is required' USING ERRCODE = '22023';
  END IF;

  IF p_cost_price IS NULL OR p_cost_price < 0 THEN
    RAISE EXCEPTION 'Cost price must be a non-negative number'
      USING ERRCODE = '22023';
  END IF;

  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Transaction date is required' USING ERRCODE = '22023';
  END IF;

  IF v_transaction_time_zone IS NULL THEN
    v_transaction_time_zone := 'Africa/Lagos';
  END IF;

  PERFORM 1
  FROM pg_timezone_names
  WHERE name = v_transaction_time_zone;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction timezone is invalid' USING ERRCODE = '22023';
  END IF;

  IF (p_transaction_date AT TIME ZONE v_transaction_time_zone)::date >
     (now() AT TIME ZONE v_transaction_time_zone)::date THEN
    RAISE EXCEPTION 'Transaction date cannot be in the future'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.order_items oi
  SET
    cost_price = p_cost_price,
    supplier_name = NULLIF(v_supplier_name, '')
  FROM public.orders o
  WHERE oi.id = p_order_item_id
    AND oi.order_id = o.id
    AND o.id = p_order_id
    AND o.merchant_id = p_merchant_id
    AND (
      p_product_id IS NULL
      OR oi.product_id = p_product_id
    )
    AND (
      p_variant_id IS NULL
      OR oi.variant_id = p_variant_id
    )
  RETURNING oi.product_id, oi.variant_id
  INTO v_order_item_product_id, v_order_item_variant_id;

  GET DIAGNOSTICS v_order_item_rows = ROW_COUNT;

  IF v_order_item_rows = 0 THEN
    RAISE EXCEPTION 'Transaction line item not found for this merchant'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_update_product_default THEN
    IF p_product_id IS NULL THEN
      RAISE EXCEPTION 'Product is required to update the catalog default'
        USING ERRCODE = '22023';
    END IF;

    IF v_order_item_product_id IS DISTINCT FROM p_product_id THEN
      RAISE EXCEPTION 'Transaction line item is not linked to this product'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_order_item_variant_id IS NOT NULL
       AND p_variant_id IS DISTINCT FROM v_order_item_variant_id THEN
      RAISE EXCEPTION 'Transaction line item is linked to a different variant'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.orders
  SET transaction_date = p_transaction_date
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id;

  GET DIAGNOSTICS v_order_rows = ROW_COUNT;

  IF v_order_rows = 0 THEN
    RAISE EXCEPTION 'Transaction not found for this merchant'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_update_product_default THEN
    IF p_variant_id IS NOT NULL THEN
      UPDATE public.product_variants v
      SET
        cost_price = p_cost_price,
        updated_at = now()
      FROM public.products p
      WHERE v.id = p_variant_id
        AND v.product_id = p_product_id
        AND v.merchant_id = p_merchant_id
        AND p.id = p_product_id
        AND p.merchant_id = p_merchant_id;
    ELSE
      UPDATE public.products
      SET
        cost_price = p_cost_price,
        metadata = CASE
          WHEN v_supplier_name = '' THEN
            COALESCE(metadata, '{}'::jsonb)
              - 'supplier_name'
              - 'supplier'
              - 'vendor_name'
              - 'vendor'
          ELSE
            (
              COALESCE(metadata, '{}'::jsonb)
                - 'supplier'
                - 'vendor'
            ) || jsonb_build_object(
              'supplier_name', v_supplier_name,
              'vendor_name', v_supplier_name
            )
        END,
        updated_at = now()
      WHERE id = p_product_id
        AND merchant_id = p_merchant_id;
    END IF;

    GET DIAGNOSTICS v_product_rows = ROW_COUNT;

    IF v_product_rows = 0 THEN
      RAISE EXCEPTION 'Product or variant not found for this merchant, or you do not have permission to update catalog defaults'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_transaction_review_details(uuid, uuid, uuid, uuid, uuid, numeric, text, timestamptz, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transaction_review_details(uuid, uuid, uuid, uuid, uuid, numeric, text, timestamptz, text, boolean) TO authenticated;
