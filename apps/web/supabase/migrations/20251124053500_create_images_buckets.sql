-- Migration: Create images and hero-images storage buckets
-- Description: Sets up storage buckets for general images and hero images with public access
-- Created: 2024-11-24

-- Create the images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Create the hero-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone (including unauthenticated) to upload to images bucket
-- This is needed for onboarding flow where users aren't authenticated yet
CREATE POLICY "Anyone can upload to images bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');

-- Policy: Allow authenticated users to upload to hero-images bucket
CREATE POLICY "Authenticated users can upload to hero-images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hero-images');

-- Policy: Allow public read access to images bucket
CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');

-- Policy: Allow public read access to hero-images bucket
CREATE POLICY "Public can view hero images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'hero-images');

-- Policy: Allow authenticated users to delete their own images
CREATE POLICY "Authenticated users can delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id IN ('images', 'hero-images'));

-- Policy: Allow authenticated users to update their own images
CREATE POLICY "Authenticated users can update images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id IN ('images', 'hero-images'));

-- Add comments for documentation
COMMENT ON POLICY "Anyone can upload to images bucket" ON storage.objects IS
'Allows anyone (including unauthenticated users during onboarding) to upload images';
COMMENT ON POLICY "Public can view images" ON storage.objects IS
'Allows public access to images for display on storefronts';
