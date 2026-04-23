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
      media.image,
      vr.created_at,
      vr.id,
      media.sort_order
    FROM variant_rows AS vr
    CROSS JOIN LATERAL (
      SELECT vr.primary_image AS image, 0 AS sort_order
      UNION ALL
      SELECT
        CASE
          WHEN jsonb_typeof(image_entry) = 'string' THEN
            NULLIF(btrim(trim(BOTH '"' FROM image_entry::text)), '')
          WHEN jsonb_typeof(image_entry) = 'object' THEN
            NULLIF(btrim(image_entry->>'url'), '')
          ELSE NULL
        END AS image,
        1 AS sort_order
      FROM jsonb_array_elements(vr.images) AS image_entry
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

SELECT public.refresh_product_variant_media_projection(id)
FROM public.products
WHERE has_variants = TRUE;
