-- Migration: Platform Analytics Views
-- Created: 2025-11-28
-- Description: Create materialized views for platform-level analytics (owner dashboard)

-- Platform-wide daily summary (aggregates all merchants)
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_daily_summary AS
SELECT
  sale_date,
  COUNT(DISTINCT merchant_id) as active_merchants,
  SUM(order_count) as total_orders,
  SUM(total_revenue) as platform_gmv,
  SUM(total_revenue) / NULLIF(COUNT(DISTINCT merchant_id), 0) as avg_gmv_per_merchant,
  SUM(unique_customers) as total_customers
FROM daily_sales_summary
GROUP BY sale_date
ORDER BY sale_date DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_daily_summary_date
  ON platform_daily_summary(sale_date);

-- Merchant health scores
CREATE MATERIALIZED VIEW IF NOT EXISTS merchant_health AS
SELECT
  m.id as merchant_id,
  m.business_name,
  m.email,
  m.created_at as joined_at,
  COALESCE(SUM(d.total_revenue), 0) as total_gmv,
  COALESCE(SUM(d.order_count), 0) as total_orders,
  MAX(d.sale_date) as last_order_date,
  COUNT(DISTINCT d.sale_date) as active_days,
  CASE
    WHEN MAX(d.sale_date) >= CURRENT_DATE - INTERVAL '7 days' THEN 'healthy'
    WHEN MAX(d.sale_date) >= CURRENT_DATE - INTERVAL '30 days' THEN 'at_risk'
    WHEN MAX(d.sale_date) IS NOT NULL THEN 'churned'
    ELSE 'new'
  END as health_status
FROM merchants m
LEFT JOIN daily_sales_summary d ON m.id = d.merchant_id
WHERE m.is_platform_admin = FALSE OR m.is_platform_admin IS NULL
GROUP BY m.id, m.business_name, m.email, m.created_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_health_id
  ON merchant_health(merchant_id);

-- Platform growth metrics (monthly merchant signups)
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_growth AS
SELECT
  date_trunc('month', m.created_at)::date as month,
  COUNT(*) as new_merchants,
  SUM(COUNT(*)) OVER (ORDER BY date_trunc('month', m.created_at)) as cumulative_merchants
FROM merchants m
WHERE m.is_platform_admin = FALSE OR m.is_platform_admin IS NULL
GROUP BY date_trunc('month', m.created_at)
ORDER BY month DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_growth_month
  ON platform_growth(month);

-- Top merchants by GMV (for leaderboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS top_merchants AS
SELECT
  m.id as merchant_id,
  m.business_name,
  m.created_at as joined_at,
  COALESCE(SUM(d.total_revenue), 0) as total_gmv,
  COALESCE(SUM(d.order_count), 0) as total_orders,
  COALESCE(AVG(d.total_revenue), 0) as avg_daily_revenue
FROM merchants m
LEFT JOIN daily_sales_summary d ON m.id = d.merchant_id
WHERE (m.is_platform_admin = FALSE OR m.is_platform_admin IS NULL)
  AND d.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.id, m.business_name, m.created_at
ORDER BY total_gmv DESC
LIMIT 50;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_merchants_id
  ON top_merchants(merchant_id);

-- Function to refresh all platform analytics views
CREATE OR REPLACE FUNCTION refresh_platform_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY merchant_health;
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_growth;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_merchants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for admin use)
GRANT EXECUTE ON FUNCTION refresh_platform_analytics_views() TO authenticated;

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW platform_daily_summary IS 'Daily platform-level metrics aggregated across all merchants';
COMMENT ON MATERIALIZED VIEW merchant_health IS 'Health status scores for all merchants based on activity';
COMMENT ON MATERIALIZED VIEW platform_growth IS 'Monthly merchant growth and cumulative totals';
COMMENT ON MATERIALIZED VIEW top_merchants IS 'Top 50 merchants by GMV in the last 30 days';
COMMENT ON FUNCTION refresh_platform_analytics_views IS 'Refresh all platform analytics materialized views concurrently';
