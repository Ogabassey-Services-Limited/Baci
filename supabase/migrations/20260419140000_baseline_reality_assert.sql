-- Baseline reality-assert migration
--
-- Defensive follow-up to 20260418000000_baseline.sql (PR #1286).
--
-- `pg_dump --schema public` has known blind spots: `storage.*` policies,
-- `supabase_realtime` publication membership, extension state in `extensions`,
-- and seeded data rows. The baseline file was amended post-squash to cover
-- those gaps, but because `supabase_migrations.schema_migrations` was manually
-- reset to mark the baseline applied before PR #1286 was opened, those
-- amendments never flow back to prod through `supabase db push` — `db push`
-- sees the baseline as applied and skips it.
--
-- This migration re-asserts each piece idempotently so:
--   (a) Prod catches up if it ever drifts away from the baseline file.
--       Today this is a no-op: every assertion below has been verified
--       present in prod via `pg_policies` / `storage.buckets` / etc.
--   (b) Fresh environments replaying from scratch land on the same state
--       prod is in, even if the baseline file is later edited incorrectly.
--   (c) The intent is version-tracked and visible to future reviewers
--       instead of hiding inside a 17k-line baseline.
--
-- Every statement is idempotent (IF EXISTS / IF NOT EXISTS / ON CONFLICT
-- DO NOTHING). No regression risk.

-- ========================================================================
-- 1. pg_net extension — used by trigger functions that invoke edge
--    functions (trigger_welcome_email, handle_new_negotiation, etc.).
-- ========================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ========================================================================
-- 2. Storage buckets — `pg_dump --schema public` does not capture the
--    `storage` schema, so buckets must be re-asserted explicitly.
--
--    Constrained buckets (hero-images, favicons, migration-imports,
--    kyc-documents) need their `file_size_limit` and `allowed_mime_types`
--    preserved so that — on a fresh env where a bucket is missing — the
--    re-assert doesn't silently recreate them without upload controls.
--    `ON CONFLICT DO NOTHING` keeps this idempotent: buckets already present
--    (including on prod) are left untouched. Matches the shapes from
--    archived migrations:
--      - hero-images:       20251130100001_hero_images_storage.sql
--      - favicons:          20251201000001_create_favicons_bucket.sql
--      - migration-imports: 20260322114500_create_migration_imports_storage_bucket.sql
--      - kyc-documents:     20260409130000_add_merchant_verifications.sql
-- ========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('media',             'media',             true),
  ('images',            'images',            true),
  ('merchant-assets',   'merchant-assets',   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('hero-images',       'hero-images',       true,  5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('favicons',          'favicons',          true,  1048576,
    ARRAY['image/svg+xml', 'image/png', 'image/x-icon']),
  ('migration-imports', 'migration-imports', false, 26214400,
    ARRAY['text/csv', 'application/vnd.ms-excel']),
  ('kyc-documents',     'kyc-documents',     false, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ========================================================================
-- 3. migration-imports storage policies — owner branch AND staff-permission
--    branch on SELECT / INSERT / UPDATE, plus the DELETE policy (used by
--    `/api/import-jobs` failure-path cleanup). Matches the hardened shape
--    from archived 20260322114500_create_migration_imports_storage_bucket.sql.
-- ========================================================================
DROP POLICY IF EXISTS "Merchants can read migration import files" ON storage.objects;
CREATE POLICY "Merchants can read migration import files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'migration-imports'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE merchants.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE public.check_staff_permission(auth.uid(), merchants.id, 'settings', 'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'orders',   'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'products', 'create')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can upload migration import files" ON storage.objects;
CREATE POLICY "Merchants can upload migration import files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'migration-imports'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE merchants.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE public.check_staff_permission(auth.uid(), merchants.id, 'settings', 'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'orders',   'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'products', 'create')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can update migration import files" ON storage.objects;
CREATE POLICY "Merchants can update migration import files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'migration-imports'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE merchants.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE public.check_staff_permission(auth.uid(), merchants.id, 'settings', 'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'orders',   'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'products', 'create')
      )
    )
  )
  WITH CHECK (
    bucket_id = 'migration-imports'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE merchants.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE public.check_staff_permission(auth.uid(), merchants.id, 'settings', 'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'orders',   'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'products', 'create')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can delete migration import files" ON storage.objects;
CREATE POLICY "Merchants can delete migration import files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'migration-imports'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE merchants.user_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT merchants.id::text FROM public.merchants
        WHERE public.check_staff_permission(auth.uid(), merchants.id, 'settings', 'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'orders',   'edit')
           OR public.check_staff_permission(auth.uid(), merchants.id, 'products', 'create')
      )
    )
  );

-- ========================================================================
-- 4. Realtime publication — `supabase_realtime` table membership is not
--    captured by `pg_dump --schema public`. Re-assert `import_jobs`.
--    Guard on the publication itself existing: on environments where
--    `supabase_realtime` hasn't been created yet, `ALTER PUBLICATION` would
--    abort the migration.
-- ========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'supabase_realtime publication is missing; skipping import_jobs re-assert';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'import_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs';
  END IF;
END
$$;

-- ========================================================================
-- 5. role_permissions seed — uses DO NOTHING rather than DO UPDATE SET so
--    this insurance migration never clobbers per-merchant permission
--    customisations that may have been applied out of band. Fresh envs
--    still land on the canonical shape because they have no existing rows.
-- ========================================================================
INSERT INTO public.role_permissions (role, permissions) VALUES
  ('admin', '{
    "pages": {"edit": true, "view": true},
    "staff": {"edit": true, "view": true, "invite": true, "remove": true},
    "orders": {"edit": true, "view": true, "create": true, "delete": true, "refund": true, "fulfill": true},
    "builder": {"edit": true, "view": true},
    "products": {"edit": true, "view": true, "create": true, "delete": true, "manage_inventory": true},
    "settings": {"edit": true, "view": true},
    "analytics": {"view": true, "export": true},
    "customers": {"edit": true, "view": true, "create": true, "delete": true},
    "dashboard": {"view": true},
    "marketing": {"edit": true, "view": true, "create": true, "delete": true},
    "integrations": {"view": true, "manage": true}
  }'::jsonb),
  ('manager', '{
    "pages": {"edit": true, "view": true},
    "staff": {"view": true},
    "orders": {"edit": true, "view": true, "create": true, "refund": true, "fulfill": true},
    "builder": {"edit": true, "view": true},
    "products": {"edit": true, "view": true, "create": true, "delete": true, "manage_inventory": true},
    "settings": {"view": true},
    "analytics": {"view": true, "export": true},
    "customers": {"edit": true, "view": true, "create": true},
    "dashboard": {"view": true},
    "marketing": {"edit": true, "view": true, "create": true, "delete": true},
    "integrations": {"view": true}
  }'::jsonb),
  ('sales_rep', '{
    "pages": {"view": false},
    "staff": {"view": false},
    "orders": {"edit": true, "view": true, "create": true},
    "builder": {"view": false},
    "products": {"view": true},
    "settings": {"view": false},
    "analytics": {"view": false},
    "customers": {"edit": true, "view": true, "create": true},
    "dashboard": {"view": true},
    "marketing": {"view": true},
    "integrations": {"view": false}
  }'::jsonb),
  ('inventory', '{
    "pages": {"view": false},
    "staff": {"view": false},
    "orders": {"view": true},
    "builder": {"view": false},
    "products": {"edit": true, "view": true, "create": true, "manage_inventory": true},
    "settings": {"view": false},
    "analytics": {"view": false},
    "customers": {"view": false},
    "dashboard": {"view": true},
    "marketing": {"view": false},
    "integrations": {"view": false}
  }'::jsonb),
  ('accountant', '{
    "pages": {"view": false},
    "staff": {"view": false},
    "orders": {"view": true},
    "builder": {"view": false},
    "products": {"view": true},
    "settings": {"view": false},
    "analytics": {"view": true, "export": true},
    "customers": {"view": true},
    "dashboard": {"view": true},
    "marketing": {"view": true},
    "integrations": {"view": false}
  }'::jsonb),
  ('customer_service', '{
    "pages": {"view": false},
    "staff": {"view": false},
    "orders": {"edit": true, "view": true, "fulfill": true},
    "builder": {"view": false},
    "products": {"view": true},
    "settings": {"view": false},
    "analytics": {"view": false},
    "customers": {"edit": true, "view": true, "create": true},
    "dashboard": {"view": true},
    "marketing": {"view": false},
    "integrations": {"view": false}
  }'::jsonb),
  ('marketing', '{
    "pages": {"edit": true, "view": true},
    "staff": {"view": false},
    "orders": {"view": true},
    "builder": {"edit": true, "view": true},
    "products": {"edit": true, "view": true},
    "settings": {"view": false},
    "analytics": {"view": true},
    "customers": {"view": true},
    "dashboard": {"view": true},
    "marketing": {"edit": true, "view": true, "create": true, "delete": true},
    "integrations": {"view": true}
  }'::jsonb),
  ('fulfillment', '{
    "pages": {"view": false},
    "staff": {"view": false},
    "orders": {"view": true, "fulfill": true},
    "builder": {"view": false},
    "products": {"view": true, "manage_inventory": true},
    "settings": {"view": false},
    "analytics": {"view": false},
    "customers": {"view": true},
    "dashboard": {"view": true},
    "marketing": {"view": false},
    "integrations": {"view": false}
  }'::jsonb),
  ('blog_manager', '{
    "pages": {"edit": true, "view": true},
    "staff": {"view": false},
    "orders": {"view": false},
    "builder": {"edit": true, "view": true},
    "products": {"view": true},
    "settings": {"view": false},
    "analytics": {"view": true},
    "customers": {"view": false},
    "dashboard": {"view": true},
    "marketing": {"edit": true, "view": true, "create": true, "delete": true},
    "integrations": {"view": false}
  }'::jsonb)
ON CONFLICT (role) DO NOTHING;
