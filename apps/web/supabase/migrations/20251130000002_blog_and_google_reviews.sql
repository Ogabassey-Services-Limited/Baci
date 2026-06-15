-- Blog System and Google Reviews Integration
-- Adds blog functionality as a paid feature and Google Places reviews integration

-- ============================================
-- 1. Add new columns to merchant_feature_settings
-- ============================================

ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS blog_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_blog_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS google_reviews_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255) DEFAULT NULL;

COMMENT ON COLUMN merchant_feature_settings.blog_enabled IS 'Whether the blog feature is enabled (Premium feature)';
COMMENT ON COLUMN merchant_feature_settings.auto_blog_enabled IS 'Whether AI auto-blog generation is enabled (Premium feature)';
COMMENT ON COLUMN merchant_feature_settings.google_reviews_enabled IS 'Whether to display Google Places reviews on storefront';
COMMENT ON COLUMN merchant_feature_settings.google_place_id IS 'Google Place ID for fetching reviews (e.g., ChIJ...)';

-- ============================================
-- 2. Create blog_posts table
-- ============================================

CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Content
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL, -- Markdown/HTML content
    excerpt TEXT, -- Short preview for listings (160 chars recommended)

    -- Featured image
    featured_image_url TEXT,
    featured_image_alt TEXT,

    -- Categorization
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}', -- SEO keywords

    -- Author info (for E-E-A-T)
    author_name TEXT NOT NULL,
    author_title TEXT, -- e.g., "Founder", "Product Expert"
    author_image_url TEXT,
    author_bio TEXT,

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

    -- SEO
    seo_title TEXT, -- Custom SEO title (defaults to title if null)
    seo_description TEXT, -- Custom meta description (defaults to excerpt if null)
    focus_keyword TEXT,

    -- Metrics
    reading_time_minutes INTEGER,
    view_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    -- AI generation tracking
    is_ai_generated BOOLEAN DEFAULT false,
    ai_topic_id UUID, -- References ai_generated_topics if applicable

    -- Unique slug per merchant
    UNIQUE(merchant_id, slug)
);

-- Indexes for blog_posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_merchant_id ON blog_posts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_merchant_status ON blog_posts(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_posts_keywords ON blog_posts USING GIN(keywords);

-- ============================================
-- 3. Create blog_categories table
-- ============================================

CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT, -- Hex color for UI
    icon TEXT, -- Icon name (lucide icon)
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_merchant_id ON blog_categories(merchant_id);

-- ============================================
-- 4. Create ai_generated_topics table
-- ============================================

CREATE TABLE IF NOT EXISTS ai_generated_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Topic details
    topic TEXT NOT NULL,
    title_suggestion TEXT,
    keywords TEXT[],
    outline TEXT, -- Brief outline of the post

    -- Scoring
    relevance_score FLOAT, -- 1-10 based on product alignment
    search_volume_estimate INTEGER,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'generated', 'rejected', 'expired')),
    generated_post_id UUID REFERENCES blog_posts(id),

    -- Metadata
    source TEXT DEFAULT 'ai', -- 'ai', 'trending', 'user-suggested'
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_topics_merchant_id ON ai_generated_topics(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_topics_status ON ai_generated_topics(status);

-- ============================================
-- 5. Create crawler_logs table (for SEO monitoring)
-- ============================================

CREATE TABLE IF NOT EXISTS crawler_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,

    -- Crawler info
    bot_name TEXT NOT NULL,
    url_path TEXT NOT NULL,
    status_code INTEGER,
    user_agent TEXT,

    -- Metadata
    response_time_ms INTEGER,
    crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by time for better performance (optional, for high volume)
CREATE INDEX IF NOT EXISTS idx_crawler_logs_merchant_id ON crawler_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_bot_name ON crawler_logs(bot_name);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_crawled_at ON crawler_logs(crawled_at DESC);

-- ============================================
-- 6. Enable RLS on new tables
-- ============================================

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS Policies for blog_posts
-- ============================================

-- Merchants can manage their own blog posts
CREATE POLICY "Merchants can manage their own blog posts"
ON blog_posts
FOR ALL
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

-- Public can read published posts
CREATE POLICY "Public can read published blog posts"
ON blog_posts
FOR SELECT
USING (status = 'published');

-- Service role has full access
CREATE POLICY "Service role can access all blog posts"
ON blog_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 8. RLS Policies for blog_categories
-- ============================================

CREATE POLICY "Merchants can manage their own blog categories"
ON blog_categories
FOR ALL
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Public can read blog categories"
ON blog_categories
FOR SELECT
USING (true);

CREATE POLICY "Service role can access all blog categories"
ON blog_categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 9. RLS Policies for ai_generated_topics
-- ============================================

CREATE POLICY "Merchants can manage their own ai topics"
ON ai_generated_topics
FOR ALL
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Service role can access all ai topics"
ON ai_generated_topics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 10. RLS Policies for crawler_logs
-- ============================================

-- Merchants can view their own crawler logs
CREATE POLICY "Merchants can view their own crawler logs"
ON crawler_logs
FOR SELECT
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

-- Only service role can insert crawler logs
CREATE POLICY "Service role can manage crawler logs"
ON crawler_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 11. Triggers for updated_at
-- ============================================

-- Blog posts updated_at trigger
CREATE TRIGGER trigger_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_feature_settings_updated_at();

-- Blog categories updated_at trigger
CREATE TRIGGER trigger_blog_categories_updated_at
    BEFORE UPDATE ON blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_feature_settings_updated_at();

-- ============================================
-- 12. Function to increment blog post view count
-- ============================================

CREATE OR REPLACE FUNCTION increment_blog_post_views(p_post_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE blog_posts
    SET view_count = view_count + 1
    WHERE id = p_post_id AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. Function to update category post counts
-- ============================================

CREATE OR REPLACE FUNCTION update_blog_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old category count if changing category
    IF TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category THEN
        UPDATE blog_categories
        SET post_count = (
            SELECT COUNT(*) FROM blog_posts
            WHERE category = OLD.category
            AND merchant_id = OLD.merchant_id
            AND status = 'published'
        )
        WHERE merchant_id = OLD.merchant_id AND name = OLD.category;
    END IF;

    -- Update new category count
    IF NEW.category IS NOT NULL THEN
        UPDATE blog_categories
        SET post_count = (
            SELECT COUNT(*) FROM blog_posts
            WHERE category = NEW.category
            AND merchant_id = NEW.merchant_id
            AND status = 'published'
        )
        WHERE merchant_id = NEW.merchant_id AND name = NEW.category;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_post_count
    AFTER INSERT OR UPDATE OF category, status OR DELETE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_category_post_count();

-- ============================================
-- 14. Comments for documentation
-- ============================================

COMMENT ON TABLE blog_posts IS 'Stores blog posts for merchant storefronts (Premium feature)';
COMMENT ON TABLE blog_categories IS 'Blog categories for organizing posts';
COMMENT ON TABLE ai_generated_topics IS 'AI-suggested blog topics for auto-generation feature';
COMMENT ON TABLE crawler_logs IS 'Logs of search engine crawler visits for SEO monitoring';
