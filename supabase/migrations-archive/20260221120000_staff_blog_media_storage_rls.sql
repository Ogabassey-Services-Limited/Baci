-- Allow staff with marketing.edit permission to manage blog images
-- in the media storage bucket under merchant_id/blog/* paths.

DROP POLICY IF EXISTS "Staff can upload blog media files" ON storage.objects;
CREATE POLICY "Staff can upload blog media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = 'blog'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text
    FROM merchants
    WHERE check_staff_permission(auth.uid(), id, 'marketing', 'edit')
  )
);

DROP POLICY IF EXISTS "Staff can update blog media files" ON storage.objects;
CREATE POLICY "Staff can update blog media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = 'blog'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text
    FROM merchants
    WHERE check_staff_permission(auth.uid(), id, 'marketing', 'edit')
  )
)
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = 'blog'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text
    FROM merchants
    WHERE check_staff_permission(auth.uid(), id, 'marketing', 'edit')
  )
);

DROP POLICY IF EXISTS "Staff can delete blog media files" ON storage.objects;
CREATE POLICY "Staff can delete blog media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = 'blog'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text
    FROM merchants
    WHERE check_staff_permission(auth.uid(), id, 'marketing', 'edit')
  )
);
