-- AI-Generated Hero Images System
-- This migration creates the infrastructure for storing and managing AI-generated hero images

-- Table to store the pool of AI-generated hero images
CREATE TABLE IF NOT EXISTS public.ai_hero_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- 'fashion', 'electronics', 'hair-extensions', 'home-goods', 'health-beauty', 'handmade', 'food-beverage'
    image_url TEXT NOT NULL, -- Supabase storage URL
    image_prompt TEXT NOT NULL, -- The prompt used to generate this image
    style_variant TEXT NOT NULL, -- 'elegant', 'modern', 'vibrant', 'luxury', 'minimal'
    usage_count INTEGER DEFAULT 0, -- Track how many merchants are using this image
    is_active BOOLEAN DEFAULT TRUE, -- Allow soft deletion/archiving
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_category CHECK (category IN (
        'fashion', 'electronics', 'hair-extensions', 'home-goods', 
        'health-beauty', 'handmade', 'food-beverage', 'other'
    )),
    CONSTRAINT valid_style CHECK (style_variant IN (
        'elegant', 'modern', 'vibrant', 'luxury', 'minimal', 'organic', 'tech'
    ))
);

-- Indexes for efficient querying
CREATE INDEX idx_ai_hero_images_category ON public.ai_hero_images(category) WHERE is_active = TRUE;
CREATE INDEX idx_ai_hero_images_usage ON public.ai_hero_images(usage_count) WHERE is_active = TRUE;
CREATE INDEX idx_ai_hero_images_category_usage ON public.ai_hero_images(category, usage_count) WHERE is_active = TRUE;

-- Add hero image tracking to merchants table
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS hero_image_ids UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN IF NOT EXISTS hero_images_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hero_images_regeneration_count INTEGER DEFAULT 0;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_hero_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER ai_hero_images_updated_at
    BEFORE UPDATE ON public.ai_hero_images
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_hero_images_updated_at();

-- RLS Policies
ALTER TABLE public.ai_hero_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active hero images
CREATE POLICY "Allow authenticated users to read active hero images"
    ON public.ai_hero_images
    FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- Only service role can insert/update hero images
CREATE POLICY "Service role can manage hero images"
    ON public.ai_hero_images
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Comment the table
COMMENT ON TABLE public.ai_hero_images IS 'Stores AI-generated hero images for merchant storefronts';
COMMENT ON COLUMN public.ai_hero_images.usage_count IS 'Number of merchants currently using this image';
COMMENT ON COLUMN public.ai_hero_images.style_variant IS 'Visual style: determined by business category';
