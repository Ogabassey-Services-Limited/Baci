-- Add SEO FAQ column to categories table for Holistic SEO content
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS seo_faq JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN categories.seo_faq IS 'List of FAQs [{question, answer}] for the category page';
