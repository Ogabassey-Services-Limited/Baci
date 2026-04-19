-- Fix blog post triggers and DELETE handling
-- This migration fixes bugs in the blog system database triggers

-- ============================================
-- 1. Create generic updated_at function
-- ============================================
-- The original migration used a non-existent function name
-- This creates the correct generic function that can be reused

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Generic trigger function to update updated_at timestamp';

-- ============================================
-- 2. Fix blog_posts updated_at trigger
-- ============================================
-- Drop the incorrectly named trigger if it exists
DROP TRIGGER IF EXISTS trigger_blog_posts_updated_at ON blog_posts;

-- Create trigger with the correct function
CREATE TRIGGER trigger_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Fix blog_categories updated_at trigger
-- ============================================
DROP TRIGGER IF EXISTS trigger_blog_categories_updated_at ON blog_categories;

CREATE TRIGGER trigger_blog_categories_updated_at
    BEFORE UPDATE ON blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Fix category post count trigger to handle DELETE
-- ============================================
-- The original trigger will fail on DELETE because it references NEW.category
-- which doesn't exist for DELETE operations

DROP TRIGGER IF EXISTS trigger_update_category_post_count ON blog_posts;
DROP FUNCTION IF EXISTS update_blog_category_post_count();

CREATE OR REPLACE FUNCTION update_blog_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle DELETE: use OLD record
    IF TG_OP = 'DELETE' THEN
        IF OLD.category IS NOT NULL THEN
            UPDATE blog_categories
            SET post_count = (
                SELECT COUNT(*) FROM blog_posts
                WHERE category = OLD.category
                AND merchant_id = OLD.merchant_id
                AND status = 'published'
            )
            WHERE merchant_id = OLD.merchant_id AND name = OLD.category;
        END IF;
        RETURN OLD; -- MUST return OLD for DELETE
    END IF;
    
    -- Handle UPDATE: update both old and new category if changed
    IF TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category THEN
        -- Update old category count
        IF OLD.category IS NOT NULL THEN
            UPDATE blog_categories
            SET post_count = (
                SELECT COUNT(*) FROM blog_posts
                WHERE category = OLD.category
                AND merchant_id = OLD.merchant_id
                AND status = 'published'
            )
            WHERE merchant_id = OLD.merchant_id AND name = OLD.category;
        END IF;
    END IF;

    -- Update new/current category count (for INSERT and UPDATE)
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

COMMENT ON FUNCTION update_blog_category_post_count() IS 'Updates blog category post counts when posts are created, updated, or deleted';

-- ============================================
-- 5. Add platform post constraint (from platform blog migration)
-- ============================================
-- Ensures platform posts don't have a merchant_id and vice versa

-- Only add if the column exists (skip if not using platform blog feature)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'blog_posts' AND column_name = 'is_platform_post'
    ) THEN
        ALTER TABLE blog_posts
        DROP CONSTRAINT IF EXISTS chk_platform_post_merchant;
        
        ALTER TABLE blog_posts
        ADD CONSTRAINT chk_platform_post_merchant
        CHECK (
          (is_platform_post = true AND merchant_id IS NULL) OR
          (is_platform_post = false AND merchant_id IS NOT NULL) OR
          (is_platform_post IS NULL AND merchant_id IS NOT NULL)
        );
    END IF;
END $$;

COMMENT ON CONSTRAINT chk_platform_post_merchant ON blog_posts IS 'Ensures platform posts have no merchant_id and regular posts have a merchant_id';
