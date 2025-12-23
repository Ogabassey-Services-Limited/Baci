-- Add metadata column to products for EAV attributes (RAM, Storage, Condition)
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
