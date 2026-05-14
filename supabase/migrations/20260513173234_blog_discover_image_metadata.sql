ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_width integer,
  ADD COLUMN IF NOT EXISTS featured_image_height integer,
  ADD COLUMN IF NOT EXISTS featured_image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS blog_discover_image_validation_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.merchant_feature_settings.blog_discover_image_validation_enabled
  IS 'When enabled, blog publish routes block posts without Discover-ready featured image metadata.';

UPDATE public.blog_posts
SET published_at = COALESCE(published_at, updated_at, created_at, now())
WHERE status = 'published'
  AND published_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_published_at_required'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_published_at_required
      CHECK (status <> 'published' OR published_at IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_width_positive'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_width_positive
      CHECK (featured_image_width IS NULL OR featured_image_width > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_height_positive'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_height_positive
      CHECK (featured_image_height IS NULL OR featured_image_height > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_posts'::regclass
      AND conname = 'blog_posts_featured_image_variants_object'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_featured_image_variants_object
      CHECK (jsonb_typeof(featured_image_variants) = 'object')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_published_at_required;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_width_positive;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_height_positive;

ALTER TABLE public.blog_posts
  VALIDATE CONSTRAINT blog_posts_featured_image_variants_object;

CREATE OR REPLACE FUNCTION public.match_blog_to_product(
  product_embedding extensions.vector,
  merchant_id_filter uuid,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 3
) RETURNS TABLE(
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  category text,
  reading_time_minutes integer,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    bp.featured_image_url,
    bp.category,
    bp.reading_time_minutes,
    1 - (bp.content_embedding <=> product_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.merchant_id = merchant_id_filter
    AND bp.status = 'published'
    AND bp.published_at IS NOT NULL
    AND bp.content_embedding IS NOT NULL
    AND 1 - (bp.content_embedding <=> product_embedding) > match_threshold
  ORDER BY bp.content_embedding <=> product_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_blog_to_product(
  extensions.vector,
  uuid,
  double precision,
  integer
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.match_blog_to_product(
  extensions.vector,
  uuid,
  double precision,
  integer
) IS 'Finds blog posts semantically similar to a product using pgvector embeddings. Used by BlogSnippet component on product pages.';
