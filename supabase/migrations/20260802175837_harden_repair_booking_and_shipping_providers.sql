-- Repair bookings are only public for published electronics/gadgets stores
-- that explicitly opted into the repairs catalogue. Carrier integrations are
-- opt-in for new stores; existing real GIGL/Topship selections are preserved.

-- ---------------------------------------------------------------------------
-- Shipping provider defaults and public checkout configuration
-- ---------------------------------------------------------------------------

ALTER TABLE public.merchant_feature_settings
  ALTER COLUMN shipping_providers SET DEFAULT '[]'::jsonb;

-- Keep active integrations for existing merchants, but remove the retired
-- Shiip placeholder and any malformed/duplicate values. This deliberately
-- does not turn carriers off for existing stores.
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
        WHERE lower(btrim(entry.value)) IN ('gigl', 'topship')
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

-- Checkout already uses this SECURITY DEFINER function for merchant shipping
-- rates. Include the sanitized carrier preference here so anonymous storefront
-- requests never need direct access to merchant_feature_settings.
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
          AND lower(btrim(entry.value)) IN ('gigl', 'topship')
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

-- A carrier quote can outlive a merchant switching the carrier off. Enforce
-- the current setting at order creation/update so a stale quote cannot create
-- a new carrier-backed order after that change.
CREATE OR REPLACE FUNCTION private.enforce_merchant_shipping_provider_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text := lower(btrim(coalesce(NEW.shipping_provider, '')));
BEGIN
  IF NEW.selected_quote_id IS NULL
    OR v_provider = '' THEN
    RETURN NEW;
  END IF;

  -- Existing orders remain fulfillable after a merchant changes settings; the
  -- guard applies only when a carrier quote or carrier selection is introduced.
  IF TG_OP = 'UPDATE'
    AND NEW.selected_quote_id IS NOT DISTINCT FROM OLD.selected_quote_id
    AND NEW.shipping_provider IS NOT DISTINCT FROM OLD.shipping_provider THEN
    RETURN NEW;
  END IF;

  IF v_provider NOT IN ('gigl', 'topship') THEN
    -- The storefront already treats this as a stale delivery selection and
    -- returns a retryable 4xx that asks the shopper to select delivery again.
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
  ) THEN
    RAISE EXCEPTION 'shipping_quote_required' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_merchant_shipping_provider_enabled()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_merchant_shipping_provider_enabled
  ON public.orders;
CREATE TRIGGER enforce_merchant_shipping_provider_enabled
  BEFORE INSERT OR UPDATE OF selected_quote_id, shipping_provider
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_merchant_shipping_provider_enabled();

-- ---------------------------------------------------------------------------
-- Repair booking RPC: the free-form legacy path must use the same public gate
-- as catalogue-backed bookings, not only the quote/device branches.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.create_repair_booking(
  p_merchant_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_device_type text,
  p_device_model text,
  p_issue_description text,
  p_preferred_date timestamptz DEFAULT NULL,
  p_service_type text DEFAULT 'dropoff',
  p_pickup_address text DEFAULT NULL,
  p_device_id uuid DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, ticket_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_repair_id uuid := gen_random_uuid();
  v_ticket integer;
  v_customer_name text := btrim(coalesce(p_customer_name, ''));
  v_normalized_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_customer_phone text := btrim(coalesce(p_customer_phone, ''));
  v_device_type text := btrim(coalesce(p_device_type, ''));
  v_device_model text := btrim(coalesce(p_device_model, ''));
  v_issue_description text := btrim(coalesce(p_issue_description, ''));
  v_service_type text := lower(btrim(coalesce(p_service_type, 'dropoff')));
  v_pickup_address text := nullif(btrim(coalesce(p_pickup_address, '')), '');
  v_quoted_price numeric(12, 2);
  v_repair_type_label text;
  v_resolved_device_id uuid;
  v_resolved_device_type text := v_device_type;
  v_resolved_device_model text := v_device_model;
  v_per_email_count integer;
  v_per_merchant_count integer;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = '22023';
  END IF;

  IF NOT public.repairs_catalog_publicly_enabled(p_merchant_id) THEN
    RAISE EXCEPTION 'catalog_disabled' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_customer_name) < 2 OR char_length(v_customer_name) > 100 THEN
    RAISE EXCEPTION 'invalid_customer_name' USING ERRCODE = '22023';
  END IF;

  IF v_normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_customer_email' USING ERRCODE = '22023';
  END IF;

  IF v_customer_phone !~ '^\+?[0-9[:space:]-]{10,}$' THEN
    RAISE EXCEPTION 'invalid_customer_phone' USING ERRCODE = '22023';
  END IF;

  IF v_device_type NOT IN ('Smartphone', 'Laptop', 'Tablet', 'Console', 'Smartwatch', 'Other') THEN
    RAISE EXCEPTION 'invalid_device_type' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_device_model) < 2 THEN
    RAISE EXCEPTION 'invalid_device_model' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_issue_description) < 10 THEN
    RAISE EXCEPTION 'invalid_issue_description' USING ERRCODE = '22023';
  END IF;

  IF v_service_type NOT IN ('dropoff', 'pickup') THEN
    RAISE EXCEPTION 'invalid_service_type' USING ERRCODE = '22023';
  END IF;

  IF v_service_type = 'pickup'
    AND (v_pickup_address IS NULL OR char_length(v_pickup_address) < 5) THEN
    RAISE EXCEPTION 'invalid_pickup_address' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_per_email_count
  FROM public.repairs AS r
  WHERE r.merchant_id = p_merchant_id
    AND lower(btrim(r.customer_email)) = v_normalized_email
    AND r.created_at > (now() - interval '1 hour');
  IF v_per_email_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_per_merchant_count
  FROM public.repairs AS r
  WHERE r.merchant_id = p_merchant_id
    AND r.created_at > (now() - interval '1 hour');
  IF v_per_merchant_count >= 100 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '22023';
  END IF;

  IF p_quote_id IS NOT NULL THEN
    SELECT
      rq.price,
      st.name,
      rq.device_id,
      coalesce(nullif(btrim(rd.device_type), ''), v_device_type),
      coalesce(nullif(btrim(rd.model), ''), v_device_model)
      INTO
        v_quoted_price,
        v_repair_type_label,
        v_resolved_device_id,
        v_resolved_device_type,
        v_resolved_device_model
    FROM public.repair_quotes AS rq
    JOIN public.repair_devices AS rd
      ON rd.id = rq.device_id AND rd.merchant_id = rq.merchant_id
    JOIN public.repair_service_types AS st
      ON st.id = rq.service_type_id AND st.merchant_id = rq.merchant_id
    WHERE rq.id = p_quote_id
      AND rq.merchant_id = p_merchant_id
      AND rq.is_active
      AND rd.is_active
      AND st.is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'quote_unavailable' USING ERRCODE = '22023';
    END IF;

    IF p_device_id IS NOT NULL AND p_device_id <> v_resolved_device_id THEN
      RAISE EXCEPTION 'device_quote_mismatch' USING ERRCODE = '22023';
    END IF;
  ELSIF p_device_id IS NOT NULL THEN
    SELECT
      rd.id,
      coalesce(nullif(btrim(rd.device_type), ''), v_device_type),
      coalesce(nullif(btrim(rd.model), ''), v_device_model)
      INTO v_resolved_device_id, v_resolved_device_type, v_resolved_device_model
    FROM public.repair_devices AS rd
    WHERE rd.id = p_device_id
      AND rd.merchant_id = p_merchant_id
      AND rd.is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.repairs (
    id, merchant_id, customer_name, customer_email, customer_phone,
    device_type, device_model, issue_description, preferred_date,
    service_type, pickup_address, status,
    device_id, quote_id, quoted_price, repair_type_label
  )
  VALUES (
    v_repair_id, p_merchant_id, v_customer_name, v_normalized_email, v_customer_phone,
    v_resolved_device_type, v_resolved_device_model, v_issue_description, p_preferred_date,
    v_service_type, v_pickup_address, 'pending',
    v_resolved_device_id, p_quote_id, v_quoted_price, v_repair_type_label
  )
  RETURNING repairs.id, repairs.ticket_number
  INTO v_repair_id, v_ticket;

  RETURN QUERY SELECT v_repair_id AS id, v_ticket AS ticket_number;
END;
$$;

REVOKE ALL ON FUNCTION private.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
