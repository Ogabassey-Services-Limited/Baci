-- Create favicons storage bucket for merchant favicon files
-- Supports SVG, PNG, and ICO formats

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'favicons',
  'favicons',
  true,
  1048576, -- 1MB limit
  ARRAY['image/svg+xml', 'image/png', 'image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for favicons bucket
-- Allow authenticated users to upload to their own merchant folder
CREATE POLICY "Merchants can upload their own favicons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'favicons'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM merchants WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update their own favicons
CREATE POLICY "Merchants can update their own favicons"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'favicons'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM merchants WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own favicons
CREATE POLICY "Merchants can delete their own favicons"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'favicons'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM merchants WHERE user_id = auth.uid()
  )
);

-- Allow public read access to all favicons (they need to be publicly accessible)
CREATE POLICY "Public read access for favicons"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'favicons');
