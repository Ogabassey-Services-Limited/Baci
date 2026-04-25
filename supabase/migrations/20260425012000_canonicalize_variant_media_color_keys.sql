CREATE OR REPLACE FUNCTION public.extract_variant_color_key(p_attributes JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(lower(public.extract_variant_color(p_attributes)), '');
$$;

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
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_product_id::TEXT, 0)
  );

  SELECT has_variants
    INTO product_has_variants
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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
      public.extract_variant_color(pv.attributes) AS color,
      public.extract_variant_color_key(pv.attributes) AS color_key,
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
      vr.color_key,
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
    WHERE vr.color_key IS NOT NULL
  ),
  distinct_media AS (
    SELECT DISTINCT ON (color_key, image)
      color_key,
      color,
      image,
      created_at,
      id,
      sort_order,
      image_ordinal
    FROM variant_media
    WHERE image IS NOT NULL
    ORDER BY color_key, image, created_at, id, sort_order, image_ordinal
  ),
  grouped_media AS (
    SELECT
      color_key,
      (ARRAY_AGG(color ORDER BY created_at, id, sort_order, image_ordinal))[1]
        AS color,
      jsonb_agg(
        image ORDER BY created_at, id, sort_order, image_ordinal
      ) AS images,
      min(created_at) AS first_seen_at,
      min(id) AS first_variant_id
    FROM distinct_media
    GROUP BY color_key
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
