-- Fix platform analytics to exclude platform-admin commerce and align headline
-- metrics to paid orders while preserving gross-order visibility in the API.

DROP MATERIALIZED VIEW IF EXISTS public.platform_daily_summary;

CREATE MATERIALIZED VIEW public.platform_daily_summary AS
SELECT
  d.sale_date,
  COUNT(DISTINCT CASE WHEN d.paid_orders > 0 THEN d.merchant_id END) AS active_merchants,
  SUM(d.paid_orders) AS total_orders,
  SUM(d.paid_revenue) AS platform_gmv,
  SUM(d.paid_revenue) /
    NULLIF(COUNT(DISTINCT CASE WHEN d.paid_orders > 0 THEN d.merchant_id END), 0) AS avg_gmv_per_merchant,
  SUM(d.unique_customers) AS total_customers
FROM public.daily_sales_summary d
JOIN public.merchants m ON m.id = d.merchant_id
WHERE m.is_platform_admin IS NOT TRUE
GROUP BY d.sale_date
ORDER BY d.sale_date DESC;

CREATE UNIQUE INDEX idx_platform_daily_summary_date
  ON public.platform_daily_summary(sale_date);

DROP MATERIALIZED VIEW IF EXISTS public.top_merchants;

CREATE MATERIALIZED VIEW public.top_merchants AS
SELECT
  m.id AS merchant_id,
  m.business_name,
  m.created_at AS joined_at,
  COALESCE(SUM(d.paid_revenue), 0) AS total_gmv,
  COALESCE(SUM(d.paid_orders), 0) AS total_orders,
  COALESCE(AVG(NULLIF(d.paid_revenue, 0)), 0) AS avg_daily_revenue
FROM public.merchants m
LEFT JOIN public.daily_sales_summary d
  ON m.id = d.merchant_id
  AND d.sale_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE m.is_platform_admin IS NOT TRUE
GROUP BY m.id, m.business_name, m.created_at
ORDER BY total_gmv DESC
LIMIT 50;

CREATE UNIQUE INDEX idx_top_merchants_id
  ON public.top_merchants(merchant_id);

CREATE OR REPLACE VIEW public.platform_revenue AS
WITH settings AS (
  SELECT
    platform_fee_percentage,
    platform_fee_flat,
    payment_processor_fee_percentage,
    payment_processor_fee_flat
  FROM public.platform_settings
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  LIMIT 1
)
SELECT
  DATE(o.created_at) AS date,
  COUNT(*) AS total_orders,
  SUM(o.total) AS gross_gmv,
  SUM(
    COALESCE(s.platform_fee_percentage, 0) / 100 * o.total +
    COALESCE(s.platform_fee_flat, 0)
  ) AS platform_fees,
  SUM(
    COALESCE(s.payment_processor_fee_percentage, 1.5) / 100 * o.total +
    COALESCE(s.payment_processor_fee_flat, 100)
  ) AS processor_fees,
  SUM(o.total) - SUM(
    COALESCE(s.platform_fee_percentage, 0) / 100 * o.total +
    COALESCE(s.platform_fee_flat, 0)
  ) AS net_to_merchants
FROM public.orders o
JOIN public.merchants m ON m.id = o.merchant_id
LEFT JOIN settings s ON TRUE
WHERE o.payment_status = 'paid'
  AND m.is_platform_admin IS NOT TRUE
GROUP BY DATE(o.created_at)
ORDER BY date DESC;

CREATE OR REPLACE FUNCTION public.get_platform_analytics_summary(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_gmv DECIMAL;
  v_current_orders INTEGER;
  v_active_merchants INTEGER;
  v_platform_revenue DECIMAL;
  v_processor_fees DECIMAL;
  v_net_to_merchants DECIMAL;
BEGIN
  SELECT
    COALESCE(SUM(platform_gmv), 0),
    COALESCE(SUM(total_orders), 0)
  INTO
    v_current_gmv,
    v_current_orders
  FROM public.platform_daily_summary
  WHERE sale_date >= p_start_date AND sale_date <= p_end_date;

  SELECT COALESCE(COUNT(DISTINCT d.merchant_id), 0)
  INTO v_active_merchants
  FROM public.daily_sales_summary d
  JOIN public.merchants m ON m.id = d.merchant_id
  WHERE d.sale_date >= p_start_date
    AND d.sale_date <= p_end_date
    AND d.paid_orders > 0
    AND m.is_platform_admin IS NOT TRUE;

  SELECT
    COALESCE(SUM(platform_fees), 0),
    COALESCE(SUM(processor_fees), 0),
    COALESCE(SUM(net_to_merchants), 0)
  INTO
    v_platform_revenue,
    v_processor_fees,
    v_net_to_merchants
  FROM public.platform_revenue
  WHERE date >= p_start_date AND date <= p_end_date;

  RETURN jsonb_build_object(
    'totalGmv', v_current_gmv,
    'totalOrders', v_current_orders,
    'activeMerchants', v_active_merchants,
    'platformRevenue', v_platform_revenue,
    'processorFees', v_processor_fees,
    'netToMerchants', v_net_to_merchants
  );
END;
$$;

GRANT SELECT ON public.platform_daily_summary TO authenticated;
GRANT SELECT ON public.top_merchants TO authenticated;
GRANT SELECT ON public.platform_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_analytics_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_analytics_summary(DATE, DATE) TO service_role;

COMMENT ON MATERIALIZED VIEW public.platform_daily_summary IS
  'Daily paid-commerce metrics for non-admin merchants only';
COMMENT ON MATERIALIZED VIEW public.top_merchants IS
  'Top 50 non-admin merchants ranked by paid GMV in the last 30 days';
COMMENT ON VIEW public.platform_revenue IS
  'Platform revenue derived from paid orders for non-admin merchants only';
