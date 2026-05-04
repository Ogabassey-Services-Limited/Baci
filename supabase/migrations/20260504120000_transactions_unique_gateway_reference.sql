-- Remove any pre-existing duplicate (order_id, gateway_reference) pairs,
-- keeping the newest row, so the unique index below can always be created
-- safely even if duplicates were inserted before this constraint existed.
DELETE FROM transactions a
  USING transactions b
  WHERE a.gateway_reference IS NOT NULL
    AND a.order_id = b.order_id
    AND a.gateway_reference = b.gateway_reference
    AND a.ctid < b.ctid;

-- Partial unique index: enforce one transaction per (order, reference) pair
-- when a gateway_reference is supplied. NULL references are excluded so that
-- reference-less manual payments can coexist on the same order.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_order_gateway_reference_key
  ON transactions (order_id, gateway_reference)
  WHERE gateway_reference IS NOT NULL;
