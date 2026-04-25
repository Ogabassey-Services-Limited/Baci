-- Keep the database default-variant projection aligned with the storefront
-- condition preference used by @baci/shared: used, open_box, then new.
CREATE OR REPLACE FUNCTION public.condition_rank(p_condition TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE public.normalize_variant_axis_value(p_condition)
    WHEN 'used' THEN 1
    WHEN 'open_box' THEN 2
    WHEN 'new' THEN 3
    ELSE 4
  END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_product_projection(
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_default_variant public.product_variants%ROWTYPE;
  v_available_conditions TEXT[];
  v_min_variant_price NUMERIC(10, 2);
  v_max_variant_price NUMERIC(10, 2);
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_product_id::TEXT, 0)
  );

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_product.variant_model <> 'sku_matrix' THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        available_conditions = '{}'::TEXT[],
        min_variant_price = NULL,
        max_variant_price = NULL
    WHERE id = p_product_id;
    RETURN;
  END IF;

  SELECT ARRAY_AGG(condition_value ORDER BY condition_rank, condition_value)
  INTO v_available_conditions
  FROM (
    SELECT DISTINCT
      public.normalize_variant_axis_value(
        COALESCE(pv.condition, v_product.condition, 'new')
      ) AS condition_value,
      public.condition_rank(
        COALESCE(pv.condition, v_product.condition, 'new')
      ) AS condition_rank
    FROM public.product_variants AS pv
    WHERE pv.product_id = p_product_id
  ) AS condition_rows
  WHERE condition_value IS NOT NULL;

  SELECT
    MIN(COALESCE(pv.price_override, v_product.price)),
    MAX(COALESCE(pv.price_override, v_product.price))
  INTO v_min_variant_price, v_max_variant_price
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id;

  SELECT pv.*
  INTO v_default_variant
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id
  ORDER BY
    CASE
      WHEN COALESCE(v_product.manage_stock, TRUE) = FALSE THEN 0
      WHEN COALESCE(pv.stock_quantity, 0) > 0 THEN 0
      ELSE 1
    END,
    public.condition_rank(
      COALESCE(pv.condition, v_product.condition, 'new')
    ),
    COALESCE(pv.price_override, v_product.price),
    pv.created_at,
    pv.id
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        has_condition_offers = FALSE,
        available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
        min_variant_price = v_min_variant_price,
        max_variant_price = v_max_variant_price
    WHERE id = p_product_id;
    RETURN;
  END IF;

  UPDATE public.products
  SET default_variant_id = v_default_variant.id,
      price = COALESCE(v_default_variant.price_override, v_product.price),
      stock_quantity = COALESCE(
        v_default_variant.stock_quantity,
        v_product.stock_quantity
      ),
      stock = COALESCE(
        v_default_variant.stock_quantity,
        v_product.stock_quantity
      ),
      condition = COALESCE(
        public.normalize_variant_axis_value(v_default_variant.condition),
        public.normalize_variant_axis_value(v_product.condition),
        'new'
      ),
      has_condition_offers = FALSE,
      available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
      min_variant_price = v_min_variant_price,
      max_variant_price = v_max_variant_price
  WHERE id = p_product_id;
END;
$$;
