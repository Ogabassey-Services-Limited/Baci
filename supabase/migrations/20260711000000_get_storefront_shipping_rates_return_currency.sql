-- ---------------------------------------------------------------------------
-- get_storefront_shipping_rates: also return the merchant's canonical currency
-- ---------------------------------------------------------------------------
-- Reproduces the current get_storefront_shipping_rates definition VERBATIM
-- (zones / locations / rates arrays, all existing checkout-safe fields) and
-- adds two scalar keys sourced from the merchant's own row:
--   - merchant_payout_currency  (merchants.payout_currency)
--   - merchant_country          (merchants.country)
--
-- Why: for a root-domain slug storefront (usebaci.com/{slug}/checkout) the
-- POST /api/shipping/quotes carries only a body merchantId and NO trusted
-- x-merchant-slug header. The route deliberately does NOT read the merchants
-- table for an arbitrary body id (anti-enumeration boundary), so it cannot
-- resolve that merchant's currency and defaults it to NGN. The stale-currency
-- filter then drops a non-NG merchant's INR/AED/etc. rates and they get no
-- quotes. This SECURITY DEFINER RPC is already the anon-safe, merchant-scoped
-- read the quote path performs; returning the currency here lets the loader
-- resolve the correct canonical currency WITHOUT any extra merchants read in
-- the route. No new enumeration vector: the RPC is already callable for this
-- merchant and its currency is already reflected in displayed prices.
--
-- Still runs as its owner so anonymous shoppers never touch the base tables;
-- every field returned is safe to show at checkout. Idempotent (CREATE OR
-- REPLACE). Existing grants (anon / authenticated / service_role) preserved.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_shipping_rates(
  p_merchant_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'zones', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', z.id,
          'name', z.name,
          'is_rest_of_world', z.is_rest_of_world
        )
        ORDER BY z.is_rest_of_world, z.name
      )
      FROM public.merchant_shipping_zones AS z
      WHERE z.merchant_id = p_merchant_id
        AND z.active
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'zone_id', l.zone_id,
          'country_code', l.country_code,
          'subdivision_code', l.subdivision_code
        )
        ORDER BY l.country_code, l.subdivision_code
      )
      FROM public.merchant_shipping_zone_locations AS l
      JOIN public.merchant_shipping_zones AS z ON z.id = l.zone_id
      WHERE z.merchant_id = p_merchant_id
        AND z.active
    ), '[]'::jsonb),
    'rates', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'zone_id', r.zone_id,
          'name', r.name,
          'kind', r.kind,
          'currency', r.currency,
          'base_amount', r.base_amount,
          'condition_type', r.condition_type,
          'min_subtotal', r.min_subtotal,
          'max_subtotal', r.max_subtotal,
          'free_over_amount', r.free_over_amount,
          'delivery_min_days', r.delivery_min_days,
          'delivery_max_days', r.delivery_max_days,
          'pickup_address', r.pickup_address,
          'sort_order', r.sort_order
        )
        ORDER BY r.sort_order, r.base_amount, r.id
      )
      FROM public.merchant_shipping_rates AS r
      JOIN public.merchant_shipping_zones AS z ON z.id = r.zone_id
      WHERE r.merchant_id = p_merchant_id
        AND r.active
        AND z.active
    ), '[]'::jsonb),
    'merchant_payout_currency', (
      SELECT m.payout_currency
      FROM public.merchants AS m
      WHERE m.id = p_merchant_id
    ),
    'merchant_country', (
      SELECT m.country
      FROM public.merchants AS m
      WHERE m.id = p_merchant_id
    )
  );
$$;

COMMENT ON FUNCTION public.get_storefront_shipping_rates(uuid) IS
  'Returns a JSON object with zones, locations, and rates arrays holding only checkout-safe fields for a store active delivery setup, plus merchant_payout_currency and merchant_country so the quote path can resolve the canonical currency without an extra merchants read. Callable by anonymous shoppers.';

REVOKE ALL ON FUNCTION public.get_storefront_shipping_rates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_shipping_rates(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
