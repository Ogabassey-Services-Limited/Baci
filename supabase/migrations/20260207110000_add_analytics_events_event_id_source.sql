-- Migration: Add event_id and source columns to analytics_events
-- Created: 2026-02-07
-- Description: Enables cross-platform event deduplication (Pixel + CAPI share
--   the same event_id) and source tracking (web vs mobile_app vs server).
--   Also drops the INSERT RLS policy since all writes use the service role
--   client (the old policy blocked anonymous storefront visitors).

-- Add columns
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';

-- Dedup index: prevents double-logging if same event_id arrives twice
-- Partial index (only rows with non-null event_id) keeps it small
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_events_dedup
  ON analytics_events (merchant_id, event_id, event_type)
  WHERE event_id IS NOT NULL;

-- Source filtering for dashboard (web vs mobile_app vs server)
CREATE INDEX IF NOT EXISTS idx_analytics_events_source
  ON analytics_events (merchant_id, source, event_type);

-- Remove the INSERT RLS policy: all writes use service role client,
-- and the current policy blocks anonymous storefront visitors
-- (auth.uid() is NULL for guests)
DROP POLICY IF EXISTS "Merchants can insert their own analytics events"
  ON analytics_events;

COMMENT ON COLUMN analytics_events.event_id IS 'Shared ID between client Pixel and server CAPI for deduplication';
COMMENT ON COLUMN analytics_events.source IS 'Event origin: web, mobile_app, or server';
