-- Align favicons storage RLS with the favicon upload API's permission check.
--
-- `apps/web/src/app/api/merchant/favicon/route.ts` authorizes staff who hold
-- `settings.edit` (the merchants row UPDATE policy "Consolidated update
-- permissions" already allows those staff to persist favicon_* columns), but
-- the baseline favicons storage policies only match folders owned by
-- `merchants.user_id = auth.uid()`. As a result a settings-staff upload passes
-- the API gate yet fails at storage RLS. This mirrors the owner-OR-staff pattern
-- already used for the `migration-imports` bucket in the baseline.

DROP POLICY IF EXISTS "Merchants can upload their own favicons" ON storage.objects;
CREATE POLICY "Merchants can upload their own favicons"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'favicons'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE m.user_id = (SELECT auth.uid())
      )
      OR (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE public.check_staff_permission((SELECT auth.uid()), m.id, 'settings', 'edit')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can update their own favicons" ON storage.objects;
CREATE POLICY "Merchants can update their own favicons"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'favicons'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE m.user_id = (SELECT auth.uid())
      )
      OR (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE public.check_staff_permission((SELECT auth.uid()), m.id, 'settings', 'edit')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can delete their own favicons" ON storage.objects;
CREATE POLICY "Merchants can delete their own favicons"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'favicons'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE m.user_id = (SELECT auth.uid())
      )
      OR (storage.foldername(name))[1] IN (
        SELECT m.id::text FROM public.merchants m
        WHERE public.check_staff_permission((SELECT auth.uid()), m.id, 'settings', 'edit')
      )
    )
  );
