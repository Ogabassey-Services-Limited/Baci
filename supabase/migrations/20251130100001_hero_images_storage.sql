-- Create storage bucket for AI-generated hero images
-- This needs to be run after the ai_hero_images table is created

-- Insert the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'hero-images',
    'hero-images',
    true, -- Public bucket for faster CDN delivery
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage
-- Allow public read access
CREATE POLICY "Public read access for hero images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hero-images');

-- Only service role can upload/delete
CREATE POLICY "Service role can upload hero images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Service role can update hero images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'hero-images');

CREATE POLICY "Service role can delete hero images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'hero-images');
