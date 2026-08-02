-- Keep the effective carrier policy in one append-only follow-up migration.
-- The original rollout migration is intentionally not edited.

CREATE OR REPLACE FUNCTION private.supported_carrier_provider_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT ARRAY['gigl', 'topship']::text[];
$$;

COMMENT ON FUNCTION private.supported_carrier_provider_ids() IS
  'Canonical merchant-configurable carrier provider ids.';

REVOKE ALL ON FUNCTION private.supported_carrier_provider_ids()
  FROM PUBLIC, anon, authenticated, service_role;

-- Re-normalize any legacy settings after the initial rollout, now through the
-- canonical helper. Existing active GIGL/Topship selections are preserved.
WITH normalized_provider_settings AS (
  SELECT
    mfs.id,
    COALESCE((
      SELECT jsonb_agg(normalized.provider ORDER BY normalized.first_position)
      FROM (
        SELECT
          lower(btrim(entry.value)) AS provider,
          min(entry.ordinality) AS first_position
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(mfs.shipping_providers) = 'array'
              THEN mfs.shipping_providers
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS entry(value, ordinality)
        WHERE lower(btrim(entry.value)) = ANY (
          private.supported_carrier_provider_ids()
        )
        GROUP BY lower(btrim(entry.value))
      ) AS normalized
    ), '[]'::jsonb) AS shipping_providers
  FROM public.merchant_feature_settings AS mfs
)
UPDATE public.merchant_feature_settings AS mfs
SET shipping_providers = normalized.shipping_providers
FROM normalized_provider_settings AS normalized
WHERE normalized.id = mfs.id
  AND mfs.shipping_providers IS DISTINCT FROM normalized.shipping_providers;

-- Public storefront reads use this SECURITY DEFINER function, so normalize the
-- carrier projection here rather than granting shoppers direct settings access.
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
    'shipping_providers', COALESCE((
      SELECT jsonb_agg(provider.provider ORDER BY provider.first_position)
      FROM (
        SELECT
          lower(btrim(entry.value)) AS provider,
          min(entry.ordinality) AS first_position
        FROM public.merchant_feature_settings AS mfs
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(mfs.shipping_providers) = 'array'
              THEN mfs.shipping_providers
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS entry(value, ordinality)
        WHERE mfs.merchant_id = p_merchant_id
          AND lower(btrim(entry.value)) = ANY (
            private.supported_carrier_provider_ids()
          )
        GROUP BY lower(btrim(entry.value))
      ) AS provider
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
  'Returns checkout-safe zones, locations, rates, enabled carrier providers, and merchant currency/country. Callable by anonymous shoppers.';

REVOKE ALL ON FUNCTION public.get_storefront_shipping_rates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_shipping_rates(uuid)
  TO anon, authenticated, service_role;

-- A named carrier selection must be authorized even when an order has not yet
-- been linked to a persisted quote. Existing orders stay mutable when their
-- carrier selection itself is unchanged.
CREATE OR REPLACE FUNCTION private.enforce_merchant_shipping_provider_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text := lower(btrim(coalesce(NEW.shipping_provider, '')));
BEGIN
  IF v_provider = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.selected_quote_id IS NOT DISTINCT FROM OLD.selected_quote_id
    AND NEW.shipping_provider IS NOT DISTINCT FROM OLD.shipping_provider THEN
    RETURN NEW;
  END IF;

  IF NOT (v_provider = ANY(private.supported_carrier_provider_ids())) THEN
    RAISE EXCEPTION 'shipping_quote_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchant_feature_settings AS mfs
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(mfs.shipping_providers) = 'array'
          THEN mfs.shipping_providers
        ELSE '[]'::jsonb
      END
    ) AS configured_provider(value)
    WHERE mfs.merchant_id = NEW.merchant_id
      AND lower(btrim(configured_provider.value)) = v_provider
      AND lower(btrim(configured_provider.value)) = ANY (
        private.supported_carrier_provider_ids()
      )
  ) THEN
    RAISE EXCEPTION 'shipping_quote_required' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_merchant_shipping_provider_enabled()
  FROM PUBLIC, anon, authenticated, service_role;
