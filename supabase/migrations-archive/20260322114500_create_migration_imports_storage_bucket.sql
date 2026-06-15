INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'migration-imports',
  'migration-imports',
  false,
  26214400,
  ARRAY['text/csv', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Merchants can read migration import files" ON storage.objects;
CREATE POLICY "Merchants can read migration import files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'migration-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE check_staff_permission(auth.uid(), id, 'settings', 'edit')
        OR check_staff_permission(auth.uid(), id, 'orders', 'edit')
        OR check_staff_permission(auth.uid(), id, 'products', 'create')
    )
  )
);

DROP POLICY IF EXISTS "Merchants can upload migration import files" ON storage.objects;
CREATE POLICY "Merchants can upload migration import files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'migration-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE check_staff_permission(auth.uid(), id, 'settings', 'edit')
        OR check_staff_permission(auth.uid(), id, 'orders', 'edit')
        OR check_staff_permission(auth.uid(), id, 'products', 'create')
    )
  )
);

DROP POLICY IF EXISTS "Merchants can update migration import files" ON storage.objects;
CREATE POLICY "Merchants can update migration import files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'migration-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE check_staff_permission(auth.uid(), id, 'settings', 'edit')
        OR check_staff_permission(auth.uid(), id, 'orders', 'edit')
        OR check_staff_permission(auth.uid(), id, 'products', 'create')
    )
  )
)
WITH CHECK (
  bucket_id = 'migration-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE check_staff_permission(auth.uid(), id, 'settings', 'edit')
        OR check_staff_permission(auth.uid(), id, 'orders', 'edit')
        OR check_staff_permission(auth.uid(), id, 'products', 'create')
    )
  )
);

DROP POLICY IF EXISTS "Merchants can delete migration import files" ON storage.objects;
CREATE POLICY "Merchants can delete migration import files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'migration-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM public.merchants
      WHERE check_staff_permission(auth.uid(), id, 'settings', 'edit')
        OR check_staff_permission(auth.uid(), id, 'orders', 'edit')
        OR check_staff_permission(auth.uid(), id, 'products', 'create')
    )
  )
);
