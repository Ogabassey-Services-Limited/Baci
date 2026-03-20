-- Migration: Fix admin merchant visibility in platform analytics
-- Date: 2026-03-20
-- Purpose:
--   Reconcile merchant_health with the intended analytics behavior so
--   incomplete signups still appear in admin health views and lists.

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

-- Populate the view immediately so the admin dashboard is not empty after deploy.
-- Use non-concurrent form because the view starts with zero rows.
REFRESH MATERIALIZED VIEW public.merchant_health;

-- Refresh strategy: the existing refresh_platform_analytics_views() function
-- (defined in 20251128200000_platform_analytics_views.sql) refreshes this view
-- concurrently along with the other platform analytics views. It is invoked by
-- the admin "Refresh" button (POST /api/admin/analytics) and can be scheduled
-- via pg_cron or a Supabase Edge Function cron for automatic freshness.
COMMENT ON MATERIALIZED VIEW public.merchant_health IS
  'Health status scores for all merchants based on activity. Refreshed via refresh_platform_analytics_views().';
