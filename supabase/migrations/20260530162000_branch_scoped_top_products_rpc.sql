DROP FUNCTION IF EXISTS public.get_top_products(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer
);

CREATE OR REPLACE FUNCTION public.get_top_products(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_limit integer DEFAULT 10,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', product_data.product_id,
          'image_url', product_data.image_url,
          'name', product_data.name,
          'price', product_data.price,
          'revenue', product_data.total_revenue,
          'total_revenue', product_data.total_revenue,
          'total_sold', product_data.total_sold,
          'units', product_data.total_sold
        )
        ORDER BY product_data.total_revenue DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        oi.product_id,
        COALESCE(p.name, oi.name) AS name,
        COALESCE(p.price, MAX(oi.price), 0) AS price,
        public.extract_primary_image_from_jsonb(p.images) AS image_url,
        COALESCE(SUM(COALESCE(oi.quantity, 1)), 0) AS total_sold,
        COALESCE(SUM(COALESCE(oi.quantity, 1) * COALESCE(oi.price, 0)), 0) AS total_revenue
      FROM public.order_items AS oi
      INNER JOIN public.orders AS o ON o.id = oi.order_id
      LEFT JOIN public.products AS p
        ON p.id = oi.product_id
        AND p.merchant_id = p_merchant_id
      WHERE o.merchant_id = p_merchant_id
        AND o.created_at >= p_start_date
        AND o.created_at <= p_end_date
        AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      GROUP BY
        oi.product_id,
        oi.name,
        p.name,
        p.price,
        p.images
      ORDER BY total_revenue DESC
      LIMIT GREATEST(COALESCE(p_limit, 10), 0)
    ) AS product_data
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  uuid
) TO anon;

GRANT EXECUTE ON FUNCTION public.get_top_products(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_top_products(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  uuid
) TO service_role;
