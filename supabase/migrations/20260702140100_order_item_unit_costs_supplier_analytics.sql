CREATE TABLE IF NOT EXISTS public.order_item_unit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  unit_index integer NOT NULL,
  cost_price numeric(10,2) NOT NULL,
  supplier_name text,
  identifier_type text,
  identifier_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_unit_costs_unit_index_non_negative
    CHECK (unit_index >= 0),
  CONSTRAINT order_item_unit_costs_cost_price_non_negative
    CHECK (cost_price >= 0),
  CONSTRAINT order_item_unit_costs_identifier_type_check
    CHECK (
      identifier_type IS NULL
      OR identifier_type IN ('imei', 'serial')
    ),
  CONSTRAINT order_item_unit_costs_order_item_unit_unique
    UNIQUE (order_item_id, unit_index)
);

COMMENT ON TABLE public.order_item_unit_costs IS
  'Per-physical-unit transaction cost and supplier ledger for order items. Used when a single order line has multiple units with different suppliers or costs.';
COMMENT ON COLUMN public.order_item_unit_costs.unit_index IS
  'Zero-based unit index within the parent order_items row.';
COMMENT ON COLUMN public.order_item_unit_costs.cost_price IS
  'Actual cost for this physical sold unit.';
COMMENT ON COLUMN public.order_item_unit_costs.supplier_name IS
  'Supplier/vendor for this physical sold unit.';
COMMENT ON COLUMN public.order_item_unit_costs.identifier_type IS
  'Identifier type captured for the sold unit: imei or serial.';
COMMENT ON COLUMN public.order_item_unit_costs.identifier_value IS
  'IMEI or serial value captured for the sold unit.';

CREATE INDEX IF NOT EXISTS idx_order_item_unit_costs_merchant_supplier
  ON public.order_item_unit_costs (merchant_id, supplier_name)
  WHERE supplier_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_item_unit_costs_merchant_order
  ON public.order_item_unit_costs (merchant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_item_unit_costs_order_item
  ON public.order_item_unit_costs (order_item_id);

DROP TRIGGER IF EXISTS update_order_item_unit_costs_updated_at
  ON public.order_item_unit_costs;
CREATE TRIGGER update_order_item_unit_costs_updated_at
  BEFORE UPDATE ON public.order_item_unit_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_item_unit_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_and_order_staff_read_unit_costs"
  ON public.order_item_unit_costs;
CREATE POLICY "owners_and_order_staff_read_unit_costs"
  ON public.order_item_unit_costs
  FOR SELECT
  TO authenticated
  USING (
    -- Unit costs expose supplier + cost data, so restrict reads to the owner and
    -- staff who can act on orders or view analytics — not every active staff
    -- member (has_merchant_access), matching the INSERT policy's scope.
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
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
      'analytics',
      'view'
    )
  );

DROP POLICY IF EXISTS "owners_and_order_staff_insert_unit_costs"
  ON public.order_item_unit_costs;
CREATE POLICY "owners_and_order_staff_insert_unit_costs"
  ON public.order_item_unit_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders AS o
      JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.id = order_item_unit_costs.order_id
        AND oi.id = order_item_unit_costs.order_item_id
        AND o.merchant_id = order_item_unit_costs.merchant_id
        AND (
          o.merchant_id IN (
            SELECT m.id
            FROM public.merchants AS m
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

DROP POLICY IF EXISTS "owners_and_order_staff_update_unit_costs"
  ON public.order_item_unit_costs;
CREATE POLICY "owners_and_order_staff_update_unit_costs"
  ON public.order_item_unit_costs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS o
      JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.id = order_item_unit_costs.order_id
        AND oi.id = order_item_unit_costs.order_item_id
        AND o.merchant_id = order_item_unit_costs.merchant_id
        AND (
          o.merchant_id IN (
            SELECT m.id
            FROM public.merchants AS m
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
      FROM public.orders AS o
      JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.id = order_item_unit_costs.order_id
        AND oi.id = order_item_unit_costs.order_item_id
        AND o.merchant_id = order_item_unit_costs.merchant_id
        AND (
          o.merchant_id IN (
            SELECT m.id
            FROM public.merchants AS m
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

GRANT SELECT, INSERT, UPDATE ON TABLE public.order_item_unit_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_item_unit_costs TO service_role;

DROP FUNCTION IF EXISTS public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  text,
  boolean
);

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
  p_update_product_default boolean DEFAULT false,
  p_unit_index integer DEFAULT NULL,
  p_identifier_type text DEFAULT NULL,
  p_identifier_value text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_identifier_type text := NULLIF(btrim(COALESCE(p_identifier_type, '')), '');
  v_identifier_value text := NULLIF(btrim(COALESCE(p_identifier_value, '')), '');
  v_order_item_product_id uuid;
  v_order_item_quantity integer;
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

  IF p_unit_index IS NOT NULL AND p_unit_index < 0 THEN
    RAISE EXCEPTION 'Unit index must be a non-negative integer'
      USING ERRCODE = '22023';
  END IF;

  IF v_identifier_type IS NOT NULL
     AND v_identifier_type NOT IN ('imei', 'serial') THEN
    RAISE EXCEPTION 'Identifier type must be imei or serial'
      USING ERRCODE = '22023';
  END IF;

  IF v_identifier_type IS NOT NULL AND v_identifier_value IS NULL THEN
    RAISE EXCEPTION 'Identifier value is required when identifier type is provided'
      USING ERRCODE = '22023';
  END IF;

  IF v_identifier_type IS NULL AND v_identifier_value IS NOT NULL THEN
    RAISE EXCEPTION 'Identifier type is required when identifier value is provided'
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

  -- For a per-unit edit (p_unit_index set) only the unit row below changes; do
  -- NOT overwrite the parent line's cost/supplier. This UPDATE still runs to
  -- validate the line exists for this merchant and to return its product/variant.
  UPDATE public.order_items AS oi
  SET
    cost_price = CASE
      WHEN p_unit_index IS NULL THEN p_cost_price
      ELSE oi.cost_price
    END,
    supplier_name = CASE
      WHEN p_unit_index IS NULL THEN NULLIF(v_supplier_name, '')
      ELSE oi.supplier_name
    END
  FROM public.orders AS o
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
  RETURNING oi.product_id, oi.variant_id, oi.quantity
  INTO v_order_item_product_id, v_order_item_variant_id, v_order_item_quantity;

  GET DIAGNOSTICS v_order_item_rows = ROW_COUNT;

  IF v_order_item_rows = 0 THEN
    RAISE EXCEPTION 'Transaction line item not found for this merchant'
      USING ERRCODE = 'P0001';
  END IF;

  -- Reject unit indexes outside the sold quantity (units are 0-based).
  IF p_unit_index IS NOT NULL
     AND p_unit_index >= COALESCE(v_order_item_quantity, 0) THEN
    RAISE EXCEPTION 'Unit index is out of range for this line item'
      USING ERRCODE = '22023';
  END IF;

  IF p_unit_index IS NOT NULL THEN
    INSERT INTO public.order_item_unit_costs (
      merchant_id,
      order_id,
      order_item_id,
      unit_index,
      cost_price,
      supplier_name,
      identifier_type,
      identifier_value
    ) VALUES (
      p_merchant_id,
      p_order_id,
      p_order_item_id,
      p_unit_index,
      p_cost_price,
      NULLIF(v_supplier_name, ''),
      v_identifier_type,
      v_identifier_value
    )
    ON CONFLICT (order_item_id, unit_index)
    DO UPDATE SET
      cost_price = EXCLUDED.cost_price,
      supplier_name = EXCLUDED.supplier_name,
      identifier_type = EXCLUDED.identifier_type,
      identifier_value = EXCLUDED.identifier_value,
      merchant_id = EXCLUDED.merchant_id,
      order_id = EXCLUDED.order_id,
      updated_at = now();
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
      UPDATE public.product_variants AS v
      SET
        cost_price = p_cost_price,
        updated_at = now()
      FROM public.products AS p
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

REVOKE EXECUTE ON FUNCTION public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  text,
  boolean,
  integer,
  text,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  text,
  boolean,
  integer,
  text,
  text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_supplier_purchase_analytics(
  p_merchant_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS TABLE (
  supplier_name text,
  unit_count bigint,
  order_count bigint,
  total_cost numeric,
  total_revenue numeric,
  gross_profit numeric,
  loss_unit_count bigint,
  missing_cost_unit_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scoped_order_items AS (
    SELECT
      o.id AS order_id,
      oi.id AS order_item_id,
      oi.quantity,
      oi.price,
      oi.cost_price AS order_item_cost_price,
      oi.supplier_name AS order_item_supplier_name,
      p.cost_price AS product_cost_price,
      p.metadata AS product_metadata,
      pv.cost_price AS variant_cost_price
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi.order_id = o.id
    LEFT JOIN public.products AS p ON p.id = oi.product_id
    LEFT JOIN public.product_variants AS pv ON pv.id = oi.variant_id
    WHERE o.merchant_id = p_merchant_id
      AND o.payment_status = 'paid'
      AND (
        p_start_date IS NULL
        OR COALESCE(o.transaction_date, o.created_at) >= p_start_date
      )
      AND (
        p_end_date IS NULL
        OR COALESCE(o.transaction_date, o.created_at) <= p_end_date
      )
  ),
  all_units AS (
    SELECT
      soi.order_id,
      1::numeric AS unit_count,
      soi.price AS unit_revenue,
      COALESCE(
        u.cost_price,
        soi.order_item_cost_price,
        soi.variant_cost_price,
        soi.product_cost_price
      ) AS unit_cost,
      COALESCE(
        NULLIF(btrim(u.supplier_name), ''),
        NULLIF(btrim(soi.order_item_supplier_name), ''),
        NULLIF(btrim(soi.product_metadata ->> 'supplier_name'), ''),
        NULLIF(btrim(soi.product_metadata ->> 'supplier'), ''),
        NULLIF(btrim(soi.product_metadata ->> 'vendor_name'), ''),
        NULLIF(btrim(soi.product_metadata ->> 'vendor'), '')
      ) AS supplier_name
    FROM scoped_order_items AS soi
    JOIN LATERAL generate_series(
      0,
      GREATEST(COALESCE(soi.quantity, 1), 0)::integer - 1
    ) AS unit(unit_index) ON true
    LEFT JOIN public.order_item_unit_costs AS u
      ON u.order_item_id = soi.order_item_id
      AND u.unit_index = unit.unit_index
  )
  SELECT
    COALESCE(NULLIF(btrim(all_units.supplier_name), ''), 'Unknown supplier'),
    SUM(all_units.unit_count)::bigint,
    COUNT(DISTINCT all_units.order_id)::bigint,
    COALESCE(SUM(COALESCE(all_units.unit_cost, 0) * all_units.unit_count), 0),
    COALESCE(SUM(COALESCE(all_units.unit_revenue, 0) * all_units.unit_count), 0),
    COALESCE(
      SUM(
        CASE
          WHEN all_units.unit_cost IS NULL THEN 0
          ELSE (COALESCE(all_units.unit_revenue, 0) - all_units.unit_cost)
            * all_units.unit_count
        END
      ),
      0
    ),
    COALESCE(
      SUM(
        CASE
          WHEN all_units.unit_cost > COALESCE(all_units.unit_revenue, 0)
            THEN all_units.unit_count
          ELSE 0
        END
      ),
      0
    )::bigint,
    COALESCE(
      SUM(
        CASE
          WHEN all_units.unit_cost IS NULL THEN all_units.unit_count
          ELSE 0
        END
      ),
      0
    )::bigint
  FROM all_units
  WHERE all_units.unit_count > 0
  GROUP BY COALESCE(NULLIF(btrim(all_units.supplier_name), ''), 'Unknown supplier')
  ORDER BY
    SUM(all_units.unit_count) DESC,
    COALESCE(SUM(COALESCE(all_units.unit_cost, 0) * all_units.unit_count), 0) DESC,
    COALESCE(NULLIF(btrim(all_units.supplier_name), ''), 'Unknown supplier') ASC;
END;
$$;

COMMENT ON FUNCTION public.get_supplier_purchase_analytics(uuid, timestamptz, timestamptz)
  IS 'Aggregates sold/recorded transaction units by supplier. Unit-level costs are preferred; order-item/catalog cost is used as a fallback until a purchase ledger exists.';

REVOKE EXECUTE ON FUNCTION public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
