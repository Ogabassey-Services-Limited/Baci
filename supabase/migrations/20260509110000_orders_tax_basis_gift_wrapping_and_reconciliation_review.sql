-- Phase A — A0 migration #1 (Δ-40, Δ-44, Δ-49, Δ-52)
--
-- Adds the order financial-consistency columns (`tax_basis`, `gift_wrapping_fee`)
-- and creates the `reconciliation_review` table so Phase A's helpers and
-- Phase B's cron can both write rows from PR1 onward. The wider B3.5 work
-- (RPC params, schema validation, atomic trigger update) stays in Phase B;
-- only the column additions + table creation + backfill ship here.
--
-- Δ-37: `tax_basis` is nullable + has no DEFAULT during the backfill window.
-- A separate post-B3.5 migration enforces NOT NULL once ops drains the
-- `tax_basis_unclassified` review queue.

-- ---------- Δ-40: order financial-consistency columns ----------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_basis TEXT
    CHECK (tax_basis IN ('exclusive', 'inclusive'));   -- nullable, no DEFAULT (Δ-37)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gift_wrapping_fee NUMERIC
    NOT NULL DEFAULT 0
    CHECK (gift_wrapping_fee >= 0);

-- Backfill `tax_basis` where the financial shape is unambiguous. Any orders
-- that don't fit either shape stay NULL and are filed for ops review below.
UPDATE orders SET tax_basis = 'exclusive'
 WHERE tax_basis IS NULL
   AND ABS(
         total - (
           subtotal
           + shipping_fee
           + COALESCE(gift_wrapping_fee, 0)
           + COALESCE(tax_amount, 0)
           - COALESCE(discount_amount, 0)
         )
       ) <= 1;

UPDATE orders SET tax_basis = 'inclusive'
 WHERE tax_basis IS NULL
   AND tax_inclusive_amount IS NOT NULL
   AND tax_inclusive_amount = total
   AND ABS(
         total - (
           subtotal
           + shipping_fee
           + COALESCE(gift_wrapping_fee, 0)
           - COALESCE(discount_amount, 0)
         )
       ) <= 1;

-- ---------- Δ-44: reconciliation_review table (pulled from B4) ----------
CREATE TABLE IF NOT EXISTS reconciliation_review (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type       TEXT NOT NULL CHECK (issue_type IN (
    'payment_match_ambiguous',
    'payment_match_zero_candidates',
    'manage_stock_cancellation_held',
    'tax_basis_unclassified',
    'tax_basis_inconsistent_total'
  )),
  txn_id           UUID,
  paystack_ref     TEXT,
  order_id         UUID,
  reason           TEXT,
  candidates       JSONB,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS reconciliation_review_open_by_type_idx
  ON reconciliation_review (issue_type, resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS reconciliation_review_by_order_idx
  ON reconciliation_review (order_id)
  WHERE order_id IS NOT NULL;

-- Δ-49: partial UNIQUE indexes for upsert on unresolved rows. Without
-- these, every cron/backfill/webhook retry would file a duplicate review
-- for the same logical issue. `WHERE resolved_at IS NULL` lets a recurrence
-- be re-filed after a previous occurrence is closed.
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_order_idx
  ON reconciliation_review (issue_type, order_id)
  WHERE resolved_at IS NULL AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_txn_idx
  ON reconciliation_review (issue_type, txn_id)
  WHERE resolved_at IS NULL AND txn_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_paystack_ref_idx
  ON reconciliation_review (issue_type, paystack_ref)
  WHERE resolved_at IS NULL AND paystack_ref IS NOT NULL;

ALTER TABLE reconciliation_review ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE reconciliation_review FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE reconciliation_review TO service_role;
-- Deliberately no policies — RLS-enabled-with-no-policies still denies
-- non-service callers even if grants are accidentally re-added.

-- File rows for orders the backfill couldn't classify so ops has a queue.
-- Δ-52: partial unique INDEX referenced by inferred columns + WHERE; the
-- `ON CONSTRAINT name` form is invalid for partial indexes.
INSERT INTO reconciliation_review (issue_type, order_id, reason, metadata)
SELECT
  'tax_basis_unclassified',
  o.id,
  'A0 backfill could not match exclusive or inclusive shape',
  jsonb_build_object(
    'subtotal',             o.subtotal,
    'shipping_fee',         o.shipping_fee,
    'gift_wrapping_fee',    o.gift_wrapping_fee,
    'tax_amount',           o.tax_amount,
    'discount_amount',      o.discount_amount,
    'total',                o.total,
    'tax_inclusive_amount', o.tax_inclusive_amount
  )
FROM orders o
WHERE o.tax_basis IS NULL
ON CONFLICT (issue_type, order_id)
  WHERE resolved_at IS NULL AND order_id IS NOT NULL
  DO NOTHING;
