-- Preserve the author-selected order of embedded products on each blog post.

ALTER TABLE public.blog_post_products
  ADD COLUMN IF NOT EXISTS position integer;

WITH ranked_links AS (
  SELECT
    link.id,
    row_number() OVER (
      PARTITION BY link.blog_post_id
      ORDER BY link.created_at ASC, link.id ASC
    )::integer AS position
  FROM public.blog_post_products AS link
)
UPDATE public.blog_post_products AS link
SET position = ranked_links.position
FROM ranked_links
WHERE link.id = ranked_links.id
  AND link.position IS NULL;

ALTER TABLE public.blog_post_products
  ALTER COLUMN position SET NOT NULL,
  ADD CONSTRAINT blog_post_products_position_positive CHECK (position > 0),
  ADD CONSTRAINT blog_post_products_blog_post_position_key
    UNIQUE (blog_post_id, position);

CREATE INDEX IF NOT EXISTS idx_blog_post_products_merchant_post_position
  ON public.blog_post_products (merchant_id, blog_post_id, position);

-- Keep the original authorization and post-persistence implementation private,
-- then wrap it with ordered link persistence without widening its authority.
ALTER FUNCTION public.mutate_merchant_blog_post_with_product_links(uuid, uuid, jsonb, uuid[])
  RENAME TO mutate_merchant_blog_post_with_product_links_base;

REVOKE ALL ON FUNCTION public.mutate_merchant_blog_post_with_product_links_base(uuid, uuid, jsonb, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mutate_merchant_blog_post_with_product_links(
  p_post_id uuid,
  p_merchant_id uuid,
  p_post_data jsonb,
  p_product_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  title text,
  slug text,
  content text,
  excerpt text,
  category text,
  featured_image_url text,
  status text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owned_product_count integer;
  v_post record;
BEGIN
  -- The base RPC authenticates and authorizes before any mutation. Passing
  -- NULL intentionally preserves links until this wrapper validates and
  -- replaces them atomically below.
  SELECT *
  INTO v_post
  FROM public.mutate_merchant_blog_post_with_product_links_base(
    p_post_id,
    p_merchant_id,
    p_post_data,
    NULL
  );

  IF p_product_ids IS NOT NULL THEN
    IF pg_catalog.cardinality(p_product_ids) > 20 THEN
      RAISE EXCEPTION 'too_many_embedded_product_ids' USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.cardinality(p_product_ids) <> (
      SELECT pg_catalog.count(DISTINCT incoming.product_id)
      FROM pg_catalog.unnest(p_product_ids) AS incoming(product_id)
    ) THEN
      RAISE EXCEPTION 'duplicate_embedded_product_ids' USING ERRCODE = '22023';
    END IF;

    SELECT pg_catalog.count(*)
    INTO v_owned_product_count
    FROM public.products AS product
    WHERE product.merchant_id = p_merchant_id
      AND product.id = ANY(p_product_ids);

    IF v_owned_product_count <> pg_catalog.cardinality(p_product_ids) THEN
      RAISE EXCEPTION 'embedded_product_not_found_or_not_owned'
        USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.blog_post_products AS link
    WHERE link.blog_post_id = v_post.id
      AND link.merchant_id = p_merchant_id;

    INSERT INTO public.blog_post_products (
      merchant_id,
      blog_post_id,
      product_id,
      relationship,
      position
    )
    SELECT
      p_merchant_id,
      v_post.id,
      incoming.product_id,
      'primary',
      incoming.position::integer
    FROM pg_catalog.unnest(p_product_ids) WITH ORDINALITY
      AS incoming(product_id, position);
  END IF;

  RETURN QUERY
  SELECT
    v_post.id,
    v_post.merchant_id,
    v_post.title,
    v_post.slug,
    v_post.content,
    v_post.excerpt,
    v_post.category,
    v_post.featured_image_url,
    v_post.status,
    v_post.published_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_merchant_blog_post_with_product_links(uuid, uuid, jsonb, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mutate_merchant_blog_post_with_product_links(uuid, uuid, jsonb, uuid[])
  TO authenticated;

COMMENT ON FUNCTION public.mutate_merchant_blog_post_with_product_links(uuid, uuid, jsonb, uuid[]) IS
  'Atomically creates or updates one marketing-authorized merchant blog post and synchronizes its product links in the submitted product ID order. Product IDs must belong to the same merchant; null product IDs preserve existing links, while an empty array clears them.';
