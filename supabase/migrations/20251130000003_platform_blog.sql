-- Platform Blog Posts
-- Allows blog posts without a merchant_id for the main Baci platform blog

-- ============================================
-- 1. Make merchant_id nullable and add platform flag
-- ============================================

ALTER TABLE blog_posts
ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS is_platform_post BOOLEAN DEFAULT false;

COMMENT ON COLUMN blog_posts.is_platform_post IS 'True if this is a Baci platform blog post (not merchant-specific)';

-- ============================================
-- 2. Index for platform posts
-- ============================================

CREATE INDEX IF NOT EXISTS idx_blog_posts_platform ON blog_posts(is_platform_post) WHERE is_platform_post = true;

-- ============================================
-- 3. Update RLS to allow public read of platform posts
-- ============================================

-- Drop and recreate the public read policy to include platform posts
DROP POLICY IF EXISTS "Public can read published blog posts" ON blog_posts;

CREATE POLICY "Public can read published blog posts"
ON blog_posts
FOR SELECT
USING (status = 'published');

-- ============================================
-- 4. RLS policy for platform post management (admins only via service role)
-- ============================================

-- Platform posts can only be managed via service role (admin dashboard)
-- This is already covered by the existing service role policy
