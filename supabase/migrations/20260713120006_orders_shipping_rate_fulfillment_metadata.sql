-- Persist which merchant-configured shipping rate an order bought.
--
-- Merchant-rate orders take the create RPC's null-provider bypass and are then
-- stamped shipping_provider = 'MERCHANT'/'MERCHANT_PICKUP' by a post-create
-- UPDATE. Until now nothing recorded WHICH rate was sold, so fulfillment could
-- not tell a store's shoppers apart across zones/tiers. This adds two nullable
-- columns the same post-create UPDATE now fills:
--
--   * shipping_rate_id   — soft link to merchant_shipping_rates(id).
--   * shipping_rate_name — durable snapshot of the rate's name at purchase.
--
-- The name is a snapshot on purpose: a rate can be edited or deleted after the
-- sale and fulfillment must still know what was bought. The id uses ON DELETE
-- SET NULL rather than a hard/RESTRICT FK so deleting a rate never blocks, and
-- the snapshot name survives the id being nulled. Idempotent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_rate_id uuid,
  ADD COLUMN IF NOT EXISTS shipping_rate_name text;

COMMENT ON COLUMN public.orders.shipping_rate_id IS
  'Merchant-configured shipping rate bought for this order; soft link (nulled if the rate row is later deleted). NULL for carrier/self-fulfil orders.';
COMMENT ON COLUMN public.orders.shipping_rate_name IS
  'Durable snapshot of the merchant shipping rate name at purchase, retained even if the rate is later edited or deleted.';

-- Soft foreign key: keep referential cleanliness without letting a rate delete
-- block, and null the link (never the snapshot name) when the rate is removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_shipping_rate_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_rate_id_fkey
      FOREIGN KEY (shipping_rate_id)
      REFERENCES public.merchant_shipping_rates (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Index the foreign key (partial: only merchant-rate orders carry a value) so
-- the ON DELETE SET NULL cleanup and any rate-scoped lookup avoid a table scan.
CREATE INDEX IF NOT EXISTS idx_orders_shipping_rate_id
  ON public.orders (shipping_rate_id)
  WHERE shipping_rate_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
