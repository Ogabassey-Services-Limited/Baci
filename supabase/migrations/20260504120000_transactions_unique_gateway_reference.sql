-- Partial unique index: enforce one transaction per (order, reference) pair
-- when a gateway_reference is supplied. NULL references are excluded so that
-- reference-less manual payments can coexist on the same order.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_order_gateway_reference_key
  ON transactions (order_id, gateway_reference)
  WHERE gateway_reference IS NOT NULL;
