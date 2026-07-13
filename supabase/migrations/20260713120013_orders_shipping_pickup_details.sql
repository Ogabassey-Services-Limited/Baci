-- Snapshot the pickup collection point for MERCHANT_PICKUP orders.
--
-- A merchant `pickup` rate carries its collection address/instructions in
-- merchant_shipping_rates.pickup_address (jsonb). Until now an order that
-- selected a pickup rate persisted only the provider ('MERCHANT_PICKUP'), the
-- soft-link shipping_rate_id, and the shipping_rate_name snapshot — NOT the
-- address. If the merchant later edits or deletes the rate, the customer and
-- merchant order views lose the collection address entirely.
--
-- This adds one nullable jsonb column the post-create stamp fills for pickup
-- orders with a durable copy of the rate's pickup_address at purchase time.
-- The snapshot survives later edits/deletes of the rate (same rationale as the
-- shipping_rate_name snapshot). NULL for carrier/self-fulfil and MERCHANT ship
-- orders. Idempotent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_pickup_details jsonb;

COMMENT ON COLUMN public.orders.shipping_pickup_details IS
  'Durable snapshot of the merchant pickup rate collection address/instructions at purchase (label, address, city, state, countryCode, instructions), retained even if the rate is later edited or deleted. NULL for carrier/self-fulfil and MERCHANT ship orders.';

NOTIFY pgrst, 'reload schema';
