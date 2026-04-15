-- Canonicalize live condition values to the three supported internal states:
--   new | used | open_box
--
-- Legacy aliases still appear in migrated rows today:
--   uk_used      -> used
--   refurbished -> open_box
--
-- Google-facing feeds and schema keep their own mapping layer. This migration
-- only fixes the internal catalog truth and rebuilds sku_matrix projections.

CREATE OR REPLACE FUNCTION public.normalize_variant_axis_value(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized_input AS (
    SELECT NULLIF(
      lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
      ''
    ) AS normalized_value
  )
  SELECT CASE normalized_value
    WHEN 'uk_used' THEN 'used'
    WHEN 'refurbished' THEN 'open_box'
    ELSE normalized_value
  END
  FROM normalized_input;
$$;

UPDATE public.products AS p
SET condition = public.normalize_variant_axis_value(p.condition)
WHERE p.condition IS NOT NULL
  AND p.condition IS DISTINCT FROM public.normalize_variant_axis_value(p.condition);

UPDATE public.product_offers AS po
SET condition = public.normalize_variant_axis_value(po.condition)
WHERE po.condition IS NOT NULL
  AND po.condition IS DISTINCT FROM public.normalize_variant_axis_value(po.condition);

UPDATE public.product_variants AS pv
SET condition = public.normalize_variant_axis_value(pv.condition)
WHERE pv.condition IS NOT NULL
  AND pv.condition IS DISTINCT FROM public.normalize_variant_axis_value(pv.condition);

DO $$
BEGIN
  IF to_regclass('public.product_offer_migration_archive') IS NOT NULL THEN
    UPDATE public.product_offer_migration_archive AS archive
    SET condition = public.normalize_variant_axis_value(archive.condition)
    WHERE archive.condition IS NOT NULL
      AND archive.condition IS DISTINCT FROM public.normalize_variant_axis_value(archive.condition);
  END IF;
END;
$$;

DO $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT id
      FROM public.products
      WHERE variant_model = 'sku_matrix'
    )
  );
END;
$$;
