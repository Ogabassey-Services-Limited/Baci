-- Migration: Add structured FAQ support for merchants
-- This enables FAQ JSON-LD schema (FAQPage) for better SEO

-- Add new column for structured FAQ data
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS faq_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN merchants.faq_items IS 'Structured FAQ items for JSON-LD FAQPage schema. Array of {question: string, answer: string, category?: string, order?: number}';

-- Create index for FAQ queries
CREATE INDEX IF NOT EXISTS idx_merchants_faq_items ON merchants USING GIN (faq_items);
