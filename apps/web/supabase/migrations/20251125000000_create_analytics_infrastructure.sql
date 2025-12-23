-- Analytics Infrastructure Migration
-- Creates tables, materialized views, and functions for advanced analytics dashboard

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ANALYTICS EVENTS TABLE
-- ============================================================================
-- Stores granular analytics events for detailed tracking and AI insights

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- 'order_created', 'product_viewed', 'customer_registered', etc.
  event_data JSONB NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  embedding vector(384), -- Optional: for AI insights using pgvector
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_id ON analytics_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_type ON analytics_events(merchant_id, event_type);

-- ============================================================================
-- DASHBOARD PREFERENCES TABLE
-- ============================================================================
-- Stores user's dashboard layout preferences for drag-and-drop cards

CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  layout_config JSONB NOT NULL DEFAULT '[]'::jsonb, -- Stores react-grid-layout configuration
  visible_cards TEXT[] DEFAULT ARRAY['revenue', 'orders', 'customers', 'products', 'sales_by_channel', 'top_products'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_dashboard_per_merchant UNIQUE(merchant_id)
);

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Daily Sales Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales_summary AS
SELECT 
  merchant_id,
  DATE(created_at) as sale_date,
  COUNT(*) as order_count,
  SUM(total) as total_revenue,
  AVG(total) as avg_order_value,
  COUNT(DISTINCT customer_id) as unique_customers,
  COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
  COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_orders,
  SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as paid_revenue
FROM orders
GROUP BY merchant_id, DATE(created_at);

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_summary_unique 
  ON daily_sales_summary(merchant_id, sale_date);

-- Product Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS product_performance AS
SELECT 
  p.merchant_id,
  p.id as product_id,
  p.name,
  p.price,
  COALESCE(COUNT(oi.id), 0) as times_sold,
  COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
  COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
  MAX(o.created_at) as last_sold_at
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
GROUP BY p.merchant_id, p.id, p.name, p.price;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_performance_unique 
  ON product_performance(merchant_id, product_id);

-- Customer Insights
CREATE MATERIALIZED VIEW IF NOT EXISTS customer_insights AS
SELECT 
  c.merchant_id,
  c.id as customer_id,
  c.email,
  c.name,
  COALESCE(COUNT(o.id), 0) as total_orders,
  COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0) as lifetime_value,
  MAX(o.created_at) as last_order_date,
  MIN(o.created_at) as first_order_date,
  COALESCE(AVG(CASE WHEN o.payment_status = 'paid' THEN o.total END), 0) as avg_order_value
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.merchant_id, c.id, c.email, c.name;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_insights_unique 
  ON customer_insights(merchant_id, customer_id);

-- Sales by Channel
CREATE MATERIALIZED VIEW IF NOT EXISTS sales_by_channel AS
SELECT 
  merchant_id,
  COALESCE(source, 'unknown') as channel,
  COUNT(*) as order_count,
  SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_revenue,
  AVG(CASE WHEN payment_status = 'paid' THEN total END) as avg_order_value
FROM orders
GROUP BY merchant_id, COALESCE(source, 'unknown');

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_by_channel_unique 
  ON sales_by_channel(merchant_id, channel);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Analytics Events Policies
CREATE POLICY "Merchants can view their own analytics events"
  ON analytics_events FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own analytics events"
  ON analytics_events FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Dashboard Preferences Policies
CREATE POLICY "Merchants can view their own dashboard preferences"
  ON dashboard_preferences FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own dashboard preferences"
  ON dashboard_preferences FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own dashboard preferences"
  ON dashboard_preferences FOR UPDATE
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for dashboard_preferences
CREATE TRIGGER update_dashboard_preferences_updated_at 
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- ============================================================================

-- Function to refresh all analytics materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_insights;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_by_channel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO authenticated;

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Create default dashboard preferences for existing merchants
INSERT INTO dashboard_preferences (merchant_id, layout_config, visible_cards)
SELECT 
  id,
  '[]'::jsonb,
  ARRAY['revenue', 'orders', 'customers', 'products', 'sales_by_channel', 'top_products']
FROM merchants
ON CONFLICT (merchant_id) DO NOTHING;

-- Initial refresh of materialized views
SELECT refresh_analytics_views();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE analytics_events IS 'Stores granular analytics events for detailed tracking and AI insights';
COMMENT ON TABLE dashboard_preferences IS 'Stores merchant dashboard layout preferences for drag-and-drop cards';
COMMENT ON MATERIALIZED VIEW daily_sales_summary IS 'Daily aggregated sales metrics per merchant';
COMMENT ON MATERIALIZED VIEW product_performance IS 'Product-level sales performance metrics';
COMMENT ON MATERIALIZED VIEW customer_insights IS 'Customer lifetime value and behavior metrics';
COMMENT ON MATERIALIZED VIEW sales_by_channel IS 'Sales breakdown by channel (WhatsApp, Instagram, etc.)';
COMMENT ON FUNCTION refresh_analytics_views() IS 'Refreshes all analytics materialized views concurrently';
