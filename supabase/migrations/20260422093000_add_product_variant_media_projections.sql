ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images JSONB NOT NULL DEFAULT '{}'::jsonb;

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
BEGIN
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
      NULLIF(btrim(media.image), '') AS image,
      vr.created_at,
      vr.id,
      media.sort_order
    FROM variant_rows AS vr
    CROSS JOIN LATERAL (
      SELECT vr.primary_image AS image, 0 AS sort_order
      UNION ALL
      SELECT jsonb_array_elements_text(vr.images) AS image, 1 AS sort_order
    ) AS media
    WHERE vr.color IS NOT NULL
  ),
  distinct_media AS (
    SELECT DISTINCT ON (color, image)
      color,
      image,
      created_at,
      id,
      sort_order
    FROM variant_media
    WHERE image IS NOT NULL
    ORDER BY color, image, created_at, id, sort_order
  ),
  grouped_media AS (
    SELECT
      color,
      jsonb_agg(image ORDER BY created_at, id, sort_order) AS images,
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
      WHEN has_variants THEN NULL
      ELSE color
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_variant_media_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_product_variant_media_projection(
    COALESCE(NEW.product_id, OLD.product_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

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
