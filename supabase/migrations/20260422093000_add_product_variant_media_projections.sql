ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Keep variant-derived product media as a projection. Merchant-authored
-- color fields remain the source of truth when has_variants is false.
CREATE OR REPLACE FUNCTION public.refresh_product_variant_media_projection(
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  projected_color_images JSONB := '{}'::jsonb;
  projected_color TEXT := NULL;
  product_has_variants BOOLEAN := FALSE;
BEGIN
  SELECT has_variants
    INTO product_has_variants
  FROM public.products
  WHERE id = p_product_id;

  IF product_has_variants IS DISTINCT FROM TRUE THEN
    UPDATE public.products
    SET
      color_images = '{}'::jsonb,
      updated_at = timezone('utc', now())
    WHERE id = p_product_id
      AND color_images IS DISTINCT FROM '{}'::jsonb;
    RETURN;
  END IF;

  WITH variant_rows AS (
    SELECT
      pv.id,
      pv.created_at,
      NULLIF(
        btrim(
          COALESCE(pv.attributes->>'color', pv.attributes->>'colour', '')
        ),
        ''
      ) AS color,
      NULLIF(btrim(pv.primary_image), '') AS primary_image,
      CASE
        WHEN jsonb_typeof(pv.images) = 'array' THEN pv.images
        ELSE '[]'::jsonb
      END AS images
    FROM public.product_variants AS pv
    WHERE pv.product_id = p_product_id
  ),
  variant_media AS (
    SELECT
      vr.color,
      media.image,
      vr.created_at,
      vr.id,
      media.sort_order,
      media.image_ordinal
    FROM variant_rows AS vr
    CROSS JOIN LATERAL (
      SELECT
        vr.primary_image AS image,
        0 AS sort_order,
        0::BIGINT AS image_ordinal
      UNION ALL
      SELECT
        CASE
          WHEN jsonb_typeof(image_entry.value) = 'string' THEN
            NULLIF(btrim(image_entry.value #>> '{}'), '')
          WHEN jsonb_typeof(image_entry.value) = 'object' THEN
            NULLIF(btrim(image_entry.value->>'url'), '')
          ELSE NULL
        END AS image,
        1 AS sort_order,
        image_entry.ordinality AS image_ordinal
      FROM jsonb_array_elements(vr.images) WITH ORDINALITY AS image_entry(
        value,
        ordinality
      )
    ) AS media
    WHERE vr.color IS NOT NULL
  ),
  distinct_media AS (
    SELECT DISTINCT ON (color, image)
      color,
      image,
      created_at,
      id,
      sort_order,
      image_ordinal
    FROM variant_media
    WHERE image IS NOT NULL
    ORDER BY color, image, created_at, id, sort_order, image_ordinal
  ),
  grouped_media AS (
    SELECT
      color,
      jsonb_agg(
        image ORDER BY created_at, id, sort_order, image_ordinal
      ) AS images,
      min(created_at) AS first_seen_at,
      min(id::text) AS first_variant_id
    FROM distinct_media
    GROUP BY color
  )
  SELECT
    COALESCE(
      jsonb_object_agg(color, images ORDER BY first_seen_at, first_variant_id),
      '{}'::jsonb
    ),
    (
      SELECT color
      FROM grouped_media
      ORDER BY first_seen_at, first_variant_id
      LIMIT 1
    )
  INTO projected_color_images, projected_color
  FROM grouped_media;

  UPDATE public.products
  SET
    color_images = projected_color_images,
    color = CASE
      WHEN projected_color IS NOT NULL THEN projected_color
      ELSE color
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_product_id
    AND has_variants = TRUE
    AND (
      color_images IS DISTINCT FROM projected_color_images
      OR (
        projected_color IS NOT NULL
        AND color IS DISTINCT FROM projected_color
      )
    );
END;
$$;

REVOKE ALL
ON FUNCTION public.refresh_product_variant_media_projection(UUID)
FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_product_variant_media_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_product_id UUID := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.product_id
    ELSE NULL
  END;
  current_product_id UUID := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.product_id
    ELSE NULL
  END;
BEGIN
  IF current_product_id IS NOT NULL THEN
    PERFORM public.refresh_product_variant_media_projection(current_product_id);
  END IF;

  IF previous_product_id IS NOT NULL
     AND previous_product_id IS DISTINCT FROM current_product_id THEN
    PERFORM public.refresh_product_variant_media_projection(previous_product_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL
ON FUNCTION public.sync_product_variant_media_projection()
FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_product_variant_media_projection_on_variants
  ON public.product_variants;

CREATE TRIGGER sync_product_variant_media_projection_on_variants
AFTER INSERT OR UPDATE OF attributes, images, primary_image, product_id OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_variant_media_projection();

CREATE OR REPLACE FUNCTION public.clear_product_variant_media_projection_on_disable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.has_variants = TRUE AND NEW.has_variants = FALSE THEN
    NEW.color_images = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_product_variant_media_projection_on_products
  ON public.products;

CREATE TRIGGER clear_product_variant_media_projection_on_products
BEFORE UPDATE OF has_variants
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.clear_product_variant_media_projection_on_disable();

UPDATE public.products
SET color_images = '{}'::jsonb
WHERE color_images IS NULL;

DO $$
DECLARE
  product_row RECORD;
BEGIN
  FOR product_row IN
    SELECT id
    FROM public.products
    WHERE has_variants = TRUE
  LOOP
    PERFORM public.refresh_product_variant_media_projection(product_row.id);
  END LOOP;
END;
$$;
