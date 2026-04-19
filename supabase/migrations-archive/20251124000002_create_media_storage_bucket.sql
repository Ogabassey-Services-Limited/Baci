-- Migration: Create media storage bucket and policies
-- Description: Sets up Supabase Storage bucket for merchant media files with RLS policies
-- Created: 2024-11-24

-- Create the media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files to their merchant folder
CREATE POLICY "Users can upload to their merchant folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
);

-- Policy: Allow authenticated users to read files from their merchant folder
CREATE POLICY "Users can read from their merchant folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
);

-- Policy: Allow public read access (for storefront display)
CREATE POLICY "Public can view media files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media');

-- Policy: Allow authenticated users to delete files from their merchant folder
CREATE POLICY "Users can delete from their merchant folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
);

-- Policy: Allow authenticated users to update files in their merchant folder
CREATE POLICY "Users can update files in their merchant folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
);

-- Add comments for documentation
COMMENT ON TABLE storage.buckets IS 'Supabase Storage buckets for file uploads';
COMMENT ON POLICY "Users can upload to their merchant folder" ON storage.objects IS
'Allows merchants to upload media files to their own folder (merchant_id/)';
COMMENT ON POLICY "Public can view media files" ON storage.objects IS
'Allows public access to media files for storefront display';
