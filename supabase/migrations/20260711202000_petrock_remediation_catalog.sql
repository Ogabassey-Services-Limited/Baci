CREATE TABLE IF NOT EXISTS public.petrock_remediation_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_product_id text NOT NULL UNIQUE,
  raw_name text NOT NULL,
  category_id text,
  carrier text,
  region text,
  model_scope jsonb NOT NULL DEFAULT '{"kind":"generic"}'::jsonb,
  status_segment text NOT NULL DEFAULT 'generic',
  refund_policy text NOT NULL CHECK (
    refund_policy IN ('refundable', 'no_refund_denial')
  ),
  success_rate numeric(5, 2) CHECK (
    success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100)
  ),
  turnaround text,
  cost_usd numeric(12, 4) CHECK (cost_usd IS NULL OR cost_usd > 0),
  price_ngn numeric(12, 2) CHECK (price_ngn IS NULL OR price_ngn > 0),
  price_usdt numeric(12, 2) CHECK (price_usdt IS NULL OR price_usdt > 0),
  order_field_name text,
  excluded_reason text,
  launch_carrier boolean NOT NULL DEFAULT false,
  fixture_verified boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'pending' CHECK (
    review_status IN ('pending', 'approved', 'rejected')
  ),
  is_active boolean NOT NULL DEFAULT false,
  manual_disabled boolean NOT NULL DEFAULT false,
  parser_version integer NOT NULL DEFAULT 1,
  catalog_synced_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_active OR (
    review_status = 'approved'
    AND fixture_verified
    AND excluded_reason IS NULL
    AND launch_carrier
    AND cost_usd IS NOT NULL
    AND price_ngn IS NOT NULL
    AND price_usdt IS NOT NULL
    AND order_field_name IS NOT NULL
  ))
);

CREATE INDEX IF NOT EXISTS idx_petrock_remediation_products_offer_lookup
  ON public.petrock_remediation_products (
    carrier,
    status_segment,
    is_active,
    manual_disabled
  )
  WHERE is_active = true AND manual_disabled = false;
CREATE INDEX IF NOT EXISTS idx_petrock_remediation_products_reviewed_by
  ON public.petrock_remediation_products (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

ALTER TABLE public.petrock_remediation_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.petrock_remediation_products FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.petrock_remediation_products TO service_role;

COMMENT ON TABLE public.petrock_remediation_products IS
  'Human-reviewed clean carrier-unlock curation. Parser output remains inactive until fixture and operator approval.';

CREATE OR REPLACE FUNCTION public.sync_petrock_remediation_products(
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer := 0;
  v_existing public.petrock_remediation_products%ROWTYPE;
  v_material_change boolean;
  v_row record;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'remediation product rows must be an array'
      USING ERRCODE = '22023';
  END IF;

  FOR v_row IN
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS x(
      provider_product_id text,
      raw_name text,
      category_id text,
      carrier text,
      region text,
      model_scope jsonb,
      status_segment text,
      refund_policy text,
      success_rate numeric,
      turnaround text,
      cost_usd numeric,
      order_field_name text,
      excluded_reason text,
      launch_carrier boolean,
      parser_version integer,
      catalog_synced_at timestamptz
    )
  LOOP
    v_existing := NULL;
    SELECT * INTO v_existing
    FROM public.petrock_remediation_products p
    WHERE p.provider_product_id = v_row.provider_product_id;

    v_material_change := v_existing.id IS NOT NULL AND (
      v_existing.raw_name IS DISTINCT FROM v_row.raw_name
      OR v_existing.category_id IS DISTINCT FROM v_row.category_id
      OR v_existing.carrier IS DISTINCT FROM v_row.carrier
      OR v_existing.region IS DISTINCT FROM v_row.region
      OR v_existing.model_scope IS DISTINCT FROM v_row.model_scope
      OR v_existing.status_segment IS DISTINCT FROM v_row.status_segment
      OR v_existing.refund_policy IS DISTINCT FROM v_row.refund_policy
      OR v_existing.success_rate IS DISTINCT FROM v_row.success_rate
      OR v_existing.turnaround IS DISTINCT FROM v_row.turnaround
      OR v_existing.cost_usd IS DISTINCT FROM v_row.cost_usd
      OR v_existing.order_field_name IS DISTINCT FROM v_row.order_field_name
      OR v_existing.excluded_reason IS DISTINCT FROM v_row.excluded_reason
      OR v_existing.launch_carrier IS DISTINCT FROM v_row.launch_carrier
      OR v_existing.parser_version IS DISTINCT FROM v_row.parser_version
    );

    INSERT INTO public.petrock_remediation_products (
      provider_product_id, raw_name, category_id, carrier, region, model_scope,
      status_segment, refund_policy, success_rate, turnaround, cost_usd,
      order_field_name, excluded_reason, launch_carrier, parser_version,
      catalog_synced_at
    ) VALUES (
      v_row.provider_product_id, v_row.raw_name, v_row.category_id,
      v_row.carrier, v_row.region, v_row.model_scope, v_row.status_segment,
      v_row.refund_policy, v_row.success_rate, v_row.turnaround, v_row.cost_usd,
      v_row.order_field_name, v_row.excluded_reason, v_row.launch_carrier,
      v_row.parser_version, v_row.catalog_synced_at
    )
    ON CONFLICT (provider_product_id) DO UPDATE SET
      raw_name = EXCLUDED.raw_name,
      category_id = EXCLUDED.category_id,
      carrier = EXCLUDED.carrier,
      region = EXCLUDED.region,
      model_scope = EXCLUDED.model_scope,
      status_segment = EXCLUDED.status_segment,
      refund_policy = EXCLUDED.refund_policy,
      success_rate = EXCLUDED.success_rate,
      turnaround = EXCLUDED.turnaround,
      cost_usd = EXCLUDED.cost_usd,
      order_field_name = EXCLUDED.order_field_name,
      excluded_reason = EXCLUDED.excluded_reason,
      launch_carrier = EXCLUDED.launch_carrier,
      parser_version = EXCLUDED.parser_version,
      catalog_synced_at = EXCLUDED.catalog_synced_at,
      review_status = CASE WHEN v_material_change THEN 'pending'
        ELSE petrock_remediation_products.review_status END,
      fixture_verified = CASE WHEN v_material_change THEN false
        ELSE petrock_remediation_products.fixture_verified END,
      reviewed_at = CASE WHEN v_material_change THEN NULL
        ELSE petrock_remediation_products.reviewed_at END,
      reviewed_by = CASE WHEN v_material_change THEN NULL
        ELSE petrock_remediation_products.reviewed_by END,
      is_active = CASE
        WHEN v_material_change
          OR EXCLUDED.excluded_reason IS NOT NULL
          OR NOT EXCLUDED.launch_carrier
          OR EXCLUDED.cost_usd IS NULL
          OR EXCLUDED.order_field_name IS NULL
        THEN false
        ELSE petrock_remediation_products.is_active
      END,
      updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.petrock_remediation_products p
  SET is_active = false,
      updated_at = now()
  WHERE p.is_active
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_rows) row_data
      WHERE row_data->>'provider_product_id' = p.provider_product_id
    );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_petrock_remediation_products(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_petrock_remediation_products(jsonb)
  TO service_role;
