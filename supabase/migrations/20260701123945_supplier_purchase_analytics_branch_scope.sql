DROP FUNCTION IF EXISTS public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz,
  uuid
);

CREATE OR REPLACE FUNCTION public.get_supplier_purchase_analytics(
  p_merchant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_branch_id uuid
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

  IF p_branch_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.branches AS b
      WHERE b.id = p_branch_id
        AND b.merchant_id = p_merchant_id
        AND b.active = true
    ) THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = '22023';
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
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
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

COMMENT ON FUNCTION public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz,
  uuid
) IS 'Aggregates paid transaction units by supplier with optional branch scope. Unit-level costs are preferred; order-item/catalog cost is used as a fallback until a purchase ledger exists.';

REVOKE EXECUTE ON FUNCTION public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz,
  uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_purchase_analytics(
  uuid,
  timestamptz,
  timestamptz,
  uuid
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
