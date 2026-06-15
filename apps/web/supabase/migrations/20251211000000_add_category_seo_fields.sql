-- Add SEO fields to categories table for Holistic SEO content
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS seo_heading TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS buying_guide_url TEXT;

-- Add checking for seo_description length (soft check, 50 chars minimum recommended but not enforced at data layer)
COMMENT ON COLUMN categories.seo_heading IS 'H2 heading for the category page (question/intent format)';
COMMENT ON COLUMN categories.seo_description IS '100-200 word extractive answer and intro content';
COMMENT ON COLUMN categories.seo_features IS 'List of key benefits/features displayed as bullet points';
