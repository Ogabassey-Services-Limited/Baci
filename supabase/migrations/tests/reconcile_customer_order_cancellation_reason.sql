-- Standalone wrapper for the transaction-neutral cancellation assertion used
-- by the production-old proof session.

BEGIN;

\ir ../../tests/migration_history_overlays/assert_repaired_cancel_order_as_customer.sql

ROLLBACK;
