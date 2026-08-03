-- disable-transaction
-- The public repair-booking RPC bounds abuse by a merchant, normalized email,
-- and recent creation time. Keep that count index-backed as repair history grows.

CREATE INDEX CONCURRENTLY IF NOT EXISTS repairs_merchant_normalized_email_created_at_idx
  ON public.repairs (merchant_id, lower(btrim(customer_email)), created_at);

COMMENT ON INDEX public.repairs_merchant_normalized_email_created_at_idx IS
  'Supports the per-email one-hour abuse limit in private.create_repair_booking.';
