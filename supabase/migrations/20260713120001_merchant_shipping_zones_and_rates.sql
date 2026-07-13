-- Merchant-configured delivery zones and rate rows.
--
-- Lets every store define geographic zones (ISO country + optional ISO
-- subdivision) and attach flat, free-over-threshold, price-tier, or local
-- pickup delivery options priced in the store's own currency. Storefront
-- checkout reads these through a security-definer routine that exposes only
-- shopper-safe fields; owner and staff writes are gated by the shared
-- settings-edit permission helper. No anonymous grants on the base tables.

-- ---------------------------------------------------------------------------
-- Zones: a named geographic bucket for a store. Exactly one zone per store may
-- carry the rest-of-world fallback flag (enforced by a partial unique index).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_rest_of_world boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_shipping_zones_name_not_blank
    CHECK (btrim(name) <> '')
);

COMMENT ON TABLE public.merchant_shipping_zones IS
  'Named geographic delivery buckets owned by a store. One rest-of-world fallback bucket is allowed per store.';
COMMENT ON COLUMN public.merchant_shipping_zones.is_rest_of_world IS
  'Marks the catch-all fallback bucket used when no more specific location matches the shopper destination.';

-- At most one rest-of-world fallback per store.
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_shipping_zones_rest_of_world
  ON public.merchant_shipping_zones (merchant_id)
  WHERE is_rest_of_world;

-- Hot path: load a store's active buckets. Leading merchant_id also serves the
-- foreign-key cleanup when a store is removed.
CREATE INDEX IF NOT EXISTS idx_merchant_shipping_zones_merchant_active
  ON public.merchant_shipping_zones (merchant_id, active);

DROP TRIGGER IF EXISTS update_merchant_shipping_zones_updated_at
  ON public.merchant_shipping_zones;
CREATE TRIGGER update_merchant_shipping_zones_updated_at
  BEFORE UPDATE ON public.merchant_shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Zone locations: the countries and subdivisions that belong to a zone.
-- A NULL subdivision means the whole country. NULLS NOT DISTINCT stops two
-- whole-country rows for the same country in the same zone.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_shipping_zone_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.merchant_shipping_zones(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL,
  subdivision_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_shipping_zone_locations_country_format
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT merchant_shipping_zone_locations_subdivision_format
    CHECK (
      subdivision_code IS NULL
      OR (
        subdivision_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
        AND left(subdivision_code, 2) = country_code
      )
    ),
  CONSTRAINT merchant_shipping_zone_locations_unique
    UNIQUE NULLS NOT DISTINCT (zone_id, country_code, subdivision_code)
);

COMMENT ON TABLE public.merchant_shipping_zone_locations IS
  'Countries and optional subdivisions that map a shopper destination onto a store delivery bucket.';
COMMENT ON COLUMN public.merchant_shipping_zone_locations.country_code IS
  'ISO 3166-1 alpha-2 country, uppercase.';
COMMENT ON COLUMN public.merchant_shipping_zone_locations.subdivision_code IS
  'ISO 3166-2 subdivision such as NG-LA; NULL means the whole country. When set, its country prefix must match country_code.';

-- Lookup by destination during checkout matching.
CREATE INDEX IF NOT EXISTS idx_merchant_shipping_zone_locations_country_subdivision
  ON public.merchant_shipping_zone_locations (country_code, subdivision_code);

-- ---------------------------------------------------------------------------
-- Rates: the priced delivery options attached to a zone.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.merchant_shipping_zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'ship',
  currency char(3) NOT NULL,
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  condition_type text NOT NULL DEFAULT 'always',
  min_subtotal numeric(12,2) NULL,
  max_subtotal numeric(12,2) NULL,
  free_over_amount numeric(12,2) NULL,
  delivery_min_days smallint NULL,
  delivery_max_days smallint NULL,
  pickup_address jsonb NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_shipping_rates_name_not_blank
    CHECK (btrim(name) <> ''),
  CONSTRAINT merchant_shipping_rates_kind_check
    CHECK (kind IN ('ship', 'pickup')),
  CONSTRAINT merchant_shipping_rates_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT merchant_shipping_rates_base_amount_non_negative
    CHECK (base_amount >= 0),
  CONSTRAINT merchant_shipping_rates_condition_type_check
    CHECK (condition_type IN ('always', 'price_tier')),
  CONSTRAINT merchant_shipping_rates_min_subtotal_non_negative
    CHECK (min_subtotal IS NULL OR min_subtotal >= 0),
  CONSTRAINT merchant_shipping_rates_max_subtotal_non_negative
    CHECK (max_subtotal IS NULL OR max_subtotal >= 0),
  CONSTRAINT merchant_shipping_rates_free_over_non_negative
    CHECK (free_over_amount IS NULL OR free_over_amount >= 0),
  CONSTRAINT merchant_shipping_rates_tier_bounds
    CHECK (
      min_subtotal IS NULL
      OR max_subtotal IS NULL
      OR max_subtotal > min_subtotal
    ),
  CONSTRAINT merchant_shipping_rates_delivery_days_non_negative
    CHECK (
      (delivery_min_days IS NULL OR delivery_min_days >= 0)
      AND (delivery_max_days IS NULL OR delivery_max_days >= 0)
    ),
  CONSTRAINT merchant_shipping_rates_delivery_days_order
    CHECK (
      delivery_min_days IS NULL
      OR delivery_max_days IS NULL
      OR delivery_max_days >= delivery_min_days
    )
);

COMMENT ON TABLE public.merchant_shipping_rates IS
  'Priced delivery options attached to a store delivery bucket. Prices are stamped in the store currency with no conversion.';
COMMENT ON COLUMN public.merchant_shipping_rates.kind IS
  'ship for carried delivery, pickup for shopper collection at a store address.';
COMMENT ON COLUMN public.merchant_shipping_rates.condition_type IS
  'always applies unconditionally; price_tier applies only when the canonical order subtotal falls within min_subtotal (inclusive) and max_subtotal (exclusive).';
COMMENT ON COLUMN public.merchant_shipping_rates.free_over_amount IS
  'When the canonical order subtotal reaches this value the computed fee drops to zero.';
COMMENT ON COLUMN public.merchant_shipping_rates.pickup_address IS
  'Display-only collection address shown for pickup options.';

-- Hot path: a store's active options for a matched bucket. Leading merchant_id
-- also serves the foreign-key cleanup when a store is removed.
CREATE INDEX IF NOT EXISTS idx_merchant_shipping_rates_merchant_zone_active
  ON public.merchant_shipping_rates (merchant_id, zone_id, active);

-- Serves the bucket join and the foreign-key cleanup when a bucket is removed.
CREATE INDEX IF NOT EXISTS idx_merchant_shipping_rates_zone
  ON public.merchant_shipping_rates (zone_id);

DROP TRIGGER IF EXISTS update_merchant_shipping_rates_updated_at
  ON public.merchant_shipping_rates;
CREATE TRIGGER update_merchant_shipping_rates_updated_at
  BEFORE UPDATE ON public.merchant_shipping_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row level security: owner and staff with settings-edit may manage all three.
-- Anonymous shoppers get no direct access; they read through the routine below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_shipping_zone_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_staff_manage_shipping_zones"
  ON public.merchant_shipping_zones;
CREATE POLICY "merchant_staff_manage_shipping_zones"
  ON public.merchant_shipping_zones
  FOR ALL
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  )
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

-- Locations carry no merchant_id, so authorization joins through the parent
-- bucket to reach the owning store.
DROP POLICY IF EXISTS "merchant_staff_manage_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;
CREATE POLICY "merchant_staff_manage_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  );

DROP POLICY IF EXISTS "merchant_staff_manage_shipping_rates"
  ON public.merchant_shipping_rates;
CREATE POLICY "merchant_staff_manage_shipping_rates"
  ON public.merchant_shipping_rates
  FOR ALL
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  )
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

-- Explicitly strip the default anonymous grants Supabase applies to new public
-- tables, then re-grant only to signed-in staff and the service role.
REVOKE ALL ON TABLE public.merchant_shipping_zones FROM anon;
REVOKE ALL ON TABLE public.merchant_shipping_zone_locations FROM anon;
REVOKE ALL ON TABLE public.merchant_shipping_rates FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.merchant_shipping_zones
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.merchant_shipping_zone_locations
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.merchant_shipping_rates
  TO authenticated;

GRANT ALL ON TABLE public.merchant_shipping_zones TO service_role;
GRANT ALL ON TABLE public.merchant_shipping_zone_locations TO service_role;
GRANT ALL ON TABLE public.merchant_shipping_rates TO service_role;

-- ---------------------------------------------------------------------------
-- Storefront read routine.
--
-- Returns one JSON object shaped as:
--   {
--     "zones":     [ { id, name, is_rest_of_world } ],
--     "locations": [ { zone_id, country_code, subdivision_code } ],
--     "rates":     [ { id, zone_id, name, kind, currency, base_amount,
--                      condition_type, min_subtotal, max_subtotal,
--                      free_over_amount, delivery_min_days, delivery_max_days,
--                      pickup_address, sort_order } ]
--   }
-- Only active buckets and active options are included, and only for the given
-- store. The client engine matches destination to bucket and computes the fee.
-- Runs as its owner so anonymous shoppers never touch the base tables; every
-- field returned is safe to show at checkout.
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
    ), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.get_storefront_shipping_rates(uuid) IS
  'Returns a JSON object with zones, locations, and rates arrays holding only checkout-safe fields for a store active delivery setup. Callable by anonymous shoppers.';

REVOKE ALL ON FUNCTION public.get_storefront_shipping_rates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_shipping_rates(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
