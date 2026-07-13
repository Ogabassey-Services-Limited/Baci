CREATE TABLE IF NOT EXISTS public.imei_provider_products (
  provider text NOT NULL,
  product_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  category_id text,
  category_name text,
  price_usd numeric(12, 4),
  currency text NOT NULL DEFAULT 'USD',
  turnaround text,
  order_field_name text,
  input_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_product jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, product_id),
  CONSTRAINT imei_provider_products_provider_check
    CHECK (provider = ANY (ARRAY['petrock'::text, 'sickw'::text])),
  CONSTRAINT imei_provider_products_currency_check
    CHECK (currency ~ '^[A-Z]{3,8}$'),
  CONSTRAINT imei_provider_products_price_check
    CHECK (price_usd IS NULL OR price_usd >= 0)
);

CREATE INDEX IF NOT EXISTS idx_imei_provider_products_active_type
  ON public.imei_provider_products (provider, type, active)
  WHERE active = true;

ALTER TABLE public.imei_provider_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.imei_provider_products FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.imei_provider_products TO service_role;

CREATE OR REPLACE FUNCTION public.sync_petrock_imei_provider_products(
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Petrock IMEI product snapshot must be a non-empty array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Petrock IMEI product snapshot must be a non-empty array'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS row_data
    WHERE row_data->>'provider' IS DISTINCT FROM 'petrock'
      OR pg_catalog.lower(COALESCE(row_data->>'type', '')) <> 'imei'
  ) THEN
    RAISE EXCEPTION 'Petrock IMEI product snapshot contains an invalid row'
      USING ERRCODE = '22023';
  END IF;

  -- Deactivation and replacement share the RPC transaction. A malformed row
  -- therefore rolls back the deactivation instead of blanking the catalog.
  UPDATE public.imei_provider_products
  SET active = false, updated_at = pg_catalog.now()
  WHERE provider = 'petrock';

  INSERT INTO public.imei_provider_products (
    provider,
    product_id,
    name,
    type,
    category_id,
    category_name,
    price_usd,
    currency,
    turnaround,
    order_field_name,
    input_fields,
    raw_product,
    active,
    synced_at
  )
  SELECT
    x.provider,
    x.product_id,
    x.name,
    x.type,
    x.category_id,
    x.category_name,
    x.price_usd,
    x.currency,
    x.turnaround,
    x.order_field_name,
    COALESCE(x.input_fields, '[]'::jsonb),
    x.raw_product,
    COALESCE(x.active, true),
    x.synced_at
  FROM jsonb_to_recordset(p_rows) AS x(
    provider text,
    product_id text,
    name text,
    type text,
    category_id text,
    category_name text,
    price_usd numeric,
    currency text,
    turnaround text,
    order_field_name text,
    input_fields jsonb,
    raw_product jsonb,
    active boolean,
    synced_at timestamptz
  )
  ON CONFLICT (provider, product_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    price_usd = EXCLUDED.price_usd,
    currency = EXCLUDED.currency,
    turnaround = EXCLUDED.turnaround,
    order_field_name = EXCLUDED.order_field_name,
    input_fields = EXCLUDED.input_fields,
    raw_product = EXCLUDED.raw_product,
    active = EXCLUDED.active,
    synced_at = EXCLUDED.synced_at,
    updated_at = pg_catalog.now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'Petrock IMEI product snapshot row count mismatch'
      USING ERRCODE = '22023';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_petrock_imei_provider_products(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_petrock_imei_provider_products(jsonb)
  TO service_role;
