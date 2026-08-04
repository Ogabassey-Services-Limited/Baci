-- Regression contract for safe append-only admin order edits.
-- Ordered parts share one transaction so the fixture and scenarios roll back together.
--
-- USAGE:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/tests/admin_order_item_append.sql

\set ON_ERROR_STOP on

BEGIN;

\ir admin_order_item_append/001_setup.sql
\ir admin_order_item_append/002_scenarios.sql

ROLLBACK;
