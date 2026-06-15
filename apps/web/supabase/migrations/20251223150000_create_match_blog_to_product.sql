-- Migration: Create match_blog_to_product function for semantic blog matching
-- This function uses pgvector to find blog posts semantically similar to a product

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the semantic matching function
CREATE OR REPLACE FUNCTION match_blog_to_product(
  product_embedding vector(768),
  merchant_id_filter uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  category text,
  reading_time_minutes int,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    AND bp.content_embedding IS NOT NULL
    AND 1 - (bp.content_embedding <=> product_embedding) > match_threshold
  ORDER BY bp.content_embedding <=> product_embedding
  LIMIT match_count;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION match_blog_to_product TO authenticated, anon;

-- Add comment for documentation
COMMENT ON FUNCTION match_blog_to_product IS 'Finds blog posts semantically similar to a product using pgvector embeddings. Used by BlogSnippet component on product pages.';
