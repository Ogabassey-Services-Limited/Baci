-- Keep analytics_events index-only scans eligible as the append-heavy table grows.
-- This changes maintenance triggers only; it does not run VACUUM during deployment.
-- Standard migrations are transaction-wrapped, so a blocked DDL retries next deploy.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.analytics_events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_threshold = 1000,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.02
);
