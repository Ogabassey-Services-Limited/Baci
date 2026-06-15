-- Migration: Remove merchant email from merchant_health materialized view
-- Date: 2026-03-20
-- Purpose:
--   Avoid persisting merchant email in a broadly readable analytics view.
--   Admin workflows that need email should query merchants directly.

DROP MATERIALIZED VIEW IF EXISTS public.merchant_health;

CREATE MATERIALIZED VIEW public.merchant_health AS
SELECT
  m.id AS merchant_id,
  m.business_name,
  m.created_at AS joined_at,
  COALESCE(SUM(d.total_revenue), 0) AS total_gmv,
  COALESCE(SUM(d.order_count), 0) AS total_orders,
  MAX(d.sale_date) AS last_order_date,
  COUNT(DISTINCT d.sale_date) AS active_days,
  CASE
    WHEN MAX(d.sale_date) >= CURRENT_DATE - INTERVAL '7 days' THEN 'healthy'
    WHEN MAX(d.sale_date) >= CURRENT_DATE - INTERVAL '30 days' THEN 'at_risk'
    WHEN MAX(d.sale_date) IS NOT NULL THEN 'churned'
    ELSE 'new'
  END AS health_status
FROM public.merchants m
LEFT JOIN public.daily_sales_summary d ON m.id = d.merchant_id
WHERE m.is_platform_admin IS NOT TRUE
GROUP BY m.id, m.business_name, m.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_health_id
  ON public.merchant_health(merchant_id);

COMMENT ON MATERIALIZED VIEW public.merchant_health IS
  'Health status scores for merchants without storing contact PII. Refreshed via refresh_platform_analytics_views().';
