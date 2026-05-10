-- Phase A — A1 follow-up #1 (Δ-77)
--
-- Δ-77 (Jules PR1563 review, Medium): the `payment_side_effects` table
-- declares `transaction_id` as a foreign key into `transactions(id) ON
-- DELETE CASCADE`, but the original migration (`20260510120000_payment_side_effects.sql`)
-- did not create a dedicated index on it. Without one, a transaction
-- delete forces a full table scan on `payment_side_effects` to find
-- and cascade rows. The repo standard (`.ruler/03-supabase.md`) is:
-- "Always add indexes on foreign keys."
--
-- Note: `order_id` is the leading column of the composite primary key
-- `(order_id, step)` so it doesn't need a separate index.

CREATE INDEX IF NOT EXISTS payment_side_effects_transaction_id_idx
  ON payment_side_effects (transaction_id);
