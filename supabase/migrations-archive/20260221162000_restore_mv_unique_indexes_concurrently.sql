-- Migration: Restore materialized-view unique indexes dropped by early perf migration state
-- Date: 2026-02-21
-- Purpose:
--   Ensure REFRESH MATERIALIZED VIEW CONCURRENTLY remains valid on analytics views
--   for environments where 20260221140000 dropped these indexes.

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_insights_unique
  ON public.customer_insights(merchant_id, customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_growth_month
  ON public.platform_growth(month);

CREATE UNIQUE INDEX IF NOT EXISTS idx_top_merchants_id
  ON public.top_merchants(merchant_id);
