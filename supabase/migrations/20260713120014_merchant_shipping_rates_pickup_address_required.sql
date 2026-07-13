-- Require a pickup rate to carry a real collection address at the DB layer.
--
-- `merchant_shipping_rates.pickup_address` is a nullable jsonb with no
-- constraint tying a non-null address to `kind = 'pickup'`. The dashboard form
-- (`merchant-shipping-rate-forms.ts`) already refuses to save a pickup rate
-- without a non-empty `pickupAddress.address`, but a `settings.edit` staffer can
-- bypass that form via the REST API and create an ACTIVE pickup rate with
-- `pickup_address = NULL`. Checkout then offers it and order-creation accepts it
-- with no delivery address (pickup rates are exempt from the ship-rate address
-- requirement), leaving `orders.shipping_pickup_details` null — the customer and
-- merchant order views lose the collection point entirely.
--
-- This mirrors the app rule in the database: a `kind = 'pickup'` row must carry
-- a pickup_address whose `address` field is a non-empty (post-trim) string. The
-- `jsonb_typeof(pickup_address->'address') = 'string'` guard is load-bearing:
-- `->>'address'` coerces a non-string JSON value (e.g. `{"address":123}`,
-- `{"address":true}`, `{"address":{}}`) to its text form, so the length check
-- alone would PASS for a number/bool/object and re-open the REST bypass. A
-- `ship` row is unaffected (the left side of the OR short-circuits), and a
-- pickup row may still omit the optional label/city/state/instructions fields.
--
-- The feature is new, so no seeded rows exist to backfill; the guarded
-- ADD CONSTRAINT validates cleanly against an empty table. Re-run safe via the
-- pg_constraint catalog check.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_rates_pickup_address_present'
      AND conrelid = 'public.merchant_shipping_rates'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_rates
      ADD CONSTRAINT merchant_shipping_rates_pickup_address_present
      CHECK (
        kind <> 'pickup'
        OR (
          pickup_address IS NOT NULL
          AND jsonb_typeof(pickup_address->'address') = 'string'
          AND length(btrim(coalesce(pickup_address->>'address', ''))) > 0
        )
      );
  END IF;
END;
$$;

COMMENT ON CONSTRAINT merchant_shipping_rates_pickup_address_present
  ON public.merchant_shipping_rates IS
  'A pickup rate must carry a pickup_address with a non-empty address field, mirroring the dashboard form rule so a REST bypass cannot create an addressless pickup rate.';

NOTIFY pgrst, 'reload schema';
