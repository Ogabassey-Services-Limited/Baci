-- =============================================
-- REGRESSION TEST: platform blog setup
--   Validates 20260516130624_platform_blog_setup.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/platform_blog_setup.sql
--   or via Supabase MCP execute_sql
--
-- This script mutates inside a transaction and rolls back. It assert-fails
-- (RAISE EXCEPTION) on missing index/policies, stale table retention, or
-- policy behavior regressions.
-- =============================================

BEGIN;

DO $$
DECLARE
  index_predicate text;
  policy_roles text;
  policy_using text;
  policy_check text;
BEGIN
  SELECT pg_get_expr(i.indpred, i.indrelid)
  INTO index_predicate
  FROM pg_class idx
  JOIN pg_index i ON i.indexrelid = idx.oid
  WHERE idx.relname = 'blog_posts_platform_slug_unique'
    AND i.indrelid = 'public.blog_posts'::regclass;

  IF index_predicate IS NULL THEN
    RAISE EXCEPTION 'blog_posts_platform_slug_unique index missing on public.blog_posts';
  END IF;

  IF index_predicate NOT ILIKE '%is_platform_post%'
     OR index_predicate NOT ILIKE '%merchant_id%'
     OR index_predicate NOT ILIKE '%IS NULL%' THEN
    RAISE EXCEPTION
      'blog_posts_platform_slug_unique predicate must constrain platform rows, found %',
      index_predicate;
  END IF;

  IF to_regclass('public.platform_blog_posts') IS NOT NULL THEN
    RAISE EXCEPTION 'public.platform_blog_posts must be dropped';
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), ''),
    COALESCE(pg_get_expr(polwithcheck, polrelid), '')
  INTO policy_roles, policy_using, policy_check
  FROM pg_policy
  WHERE polrelid = 'public.blog_posts'::regclass
    AND polname = 'Platform admins can insert platform blog posts';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can insert platform blog posts';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'insert platform blog policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_check NOT ILIKE '%is_platform_post%'
     OR policy_check NOT ILIKE '%merchant_id IS NULL%'
     OR policy_check NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'insert platform blog policy check is incomplete: %', policy_check;
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), ''),
    COALESCE(pg_get_expr(polwithcheck, polrelid), '')
  INTO policy_roles, policy_using, policy_check
  FROM pg_policy
  WHERE polrelid = 'public.blog_posts'::regclass
    AND polname = 'Platform admins can update platform blog posts';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can update platform blog posts';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'update platform blog policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_using NOT ILIKE '%is_platform_post%'
     OR policy_using NOT ILIKE '%merchant_id IS NULL%'
     OR policy_using NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'update platform blog policy using is incomplete: %', policy_using;
  END IF;

  IF policy_check NOT ILIKE '%is_platform_post%'
     OR policy_check NOT ILIKE '%merchant_id IS NULL%'
     OR policy_check NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'update platform blog policy check is incomplete: %', policy_check;
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), '')
  INTO policy_roles, policy_using
  FROM pg_policy
  WHERE polrelid = 'public.blog_posts'::regclass
    AND polname = 'Platform admins can delete platform blog posts';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can delete platform blog posts';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'delete platform blog policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_using NOT ILIKE '%is_platform_post%'
     OR policy_using NOT ILIKE '%merchant_id IS NULL%'
     OR policy_using NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'delete platform blog policy using is incomplete: %', policy_using;
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), ''),
    COALESCE(pg_get_expr(polwithcheck, polrelid), '')
  INTO policy_roles, policy_using, policy_check
  FROM pg_policy
  WHERE polrelid = 'storage.objects'::regclass
    AND polname = 'Platform admins can upload platform blog media';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can upload platform blog media';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'upload platform media policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_check NOT ILIKE '%bucket_id = ''media''%'
     OR policy_check NOT ILIKE '%foldername%'
     OR policy_check NOT ILIKE '%''platform''%'
     OR policy_check NOT ILIKE '%''blog''%'
     OR policy_check NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'upload platform media policy check is incomplete: %', policy_check;
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), ''),
    COALESCE(pg_get_expr(polwithcheck, polrelid), '')
  INTO policy_roles, policy_using, policy_check
  FROM pg_policy
  WHERE polrelid = 'storage.objects'::regclass
    AND polname = 'Platform admins can update platform blog media';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can update platform blog media';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'update platform media policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_using NOT ILIKE '%bucket_id = ''media''%'
     OR policy_using NOT ILIKE '%foldername%'
     OR policy_using NOT ILIKE '%''platform''%'
     OR policy_using NOT ILIKE '%''blog''%'
     OR policy_using NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'update platform media policy using is incomplete: %', policy_using;
  END IF;

  IF policy_check NOT ILIKE '%bucket_id = ''media''%'
     OR policy_check NOT ILIKE '%foldername%'
     OR policy_check NOT ILIKE '%''platform''%'
     OR policy_check NOT ILIKE '%''blog''%'
     OR policy_check NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'update platform media policy check is incomplete: %', policy_check;
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    COALESCE(pg_get_expr(polqual, polrelid), '')
  INTO policy_roles, policy_using
  FROM pg_policy
  WHERE polrelid = 'storage.objects'::regclass
    AND polname = 'Platform admins can delete platform blog media';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'missing policy: Platform admins can delete platform blog media';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'delete platform media policy must target authenticated, found %', policy_roles;
  END IF;

  IF policy_using NOT ILIKE '%bucket_id = ''media''%'
     OR policy_using NOT ILIKE '%foldername%'
     OR policy_using NOT ILIKE '%''platform''%'
     OR policy_using NOT ILIKE '%''blog''%'
     OR policy_using NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION 'delete platform media policy using is incomplete: %', policy_using;
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES
  (
    '00000000-0000-4000-8000-00000000c101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'platform-admin-test@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-00000000c102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'platform-regular-test@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

INSERT INTO public.merchants (id, user_id, email, business_name, slug, is_platform_admin)
VALUES
  (
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-00000000c101',
    'platform-admin-test@example.com',
    'Platform Admin Test Merchant',
    'platform-admin-test-merchant',
    true
  ),
  (
    '00000000-0000-4000-8000-00000000c202',
    '00000000-0000-4000-8000-00000000c102',
    'platform-regular-test@example.com',
    'Platform Regular Test Merchant',
    'platform-regular-test-merchant',
    false
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c102', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.blog_posts (
      merchant_id,
      title,
      slug,
      content,
      author_name,
      status,
      is_platform_post,
      published_at
    )
    VALUES (
      NULL,
      'Regular user should not create platform post',
      'regular-user-should-not-create-platform-post',
      'blocked',
      'Regular User',
      'published',
      true,
      now()
    );

    RAISE EXCEPTION 'non-platform-admin unexpectedly inserted platform blog post';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES (
      'media',
      'platform/blog/regular-user-should-not-upload.txt',
      '00000000-0000-4000-8000-00000000c102'::uuid
    );

    RAISE EXCEPTION 'non-platform-admin unexpectedly uploaded platform blog media';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c101', true);

DO $$
DECLARE
  visible_platform_admin_rows bigint := 0;
BEGIN
  SELECT count(*)
  INTO visible_platform_admin_rows
  FROM public.merchants
  WHERE user_id = '00000000-0000-4000-8000-00000000c101'::uuid
    AND is_platform_admin IS TRUE;

  IF visible_platform_admin_rows <> 1 THEN
    RAISE EXCEPTION
      'platform-admin merchants self-row not visible under RLS; EXISTS predicate may resolve false';
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.blog_posts (
  merchant_id,
  title,
  slug,
  content,
  author_name,
  status,
  is_platform_post,
  published_at
)
VALUES (
  NULL,
  'Platform admin can create platform post',
  'platform-admin-can-create-platform-post',
  'allowed',
  'Platform Admin',
  'published',
  true,
  now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.blog_posts
    WHERE slug = 'platform-admin-can-create-platform-post'
      AND is_platform_post IS TRUE
      AND merchant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'platform admin insert did not persist expected platform blog post';
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO storage.objects (bucket_id, name, owner)
VALUES (
  'media',
  'platform/blog/platform-admin-can-upload.txt',
  '00000000-0000-4000-8000-00000000c101'::uuid
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'media'
      AND name = 'platform/blog/platform-admin-can-upload.txt'
  ) THEN
    RAISE EXCEPTION 'platform admin upload did not persist expected storage object';
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c102', true);

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  UPDATE public.blog_posts
  SET title = 'Regular user should not update platform post'
  WHERE slug = 'platform-admin-can-create-platform-post';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'non-platform-admin unexpectedly updated platform blog post';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  DELETE FROM public.blog_posts
  WHERE slug = 'platform-admin-can-create-platform-post';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'non-platform-admin unexpectedly deleted platform blog post';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  UPDATE storage.objects
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"attempted_by":"regular-user"}'::jsonb
  WHERE bucket_id = 'media'
    AND name = 'platform/blog/platform-admin-can-upload.txt';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'non-platform-admin unexpectedly updated platform blog media object';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'media'
    AND name = 'platform/blog/platform-admin-can-upload.txt';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'non-platform-admin unexpectedly deleted platform blog media object';
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c101', true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.blog_posts
    WHERE slug = 'platform-admin-can-create-platform-post'
      AND is_platform_post IS TRUE
      AND merchant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'platform post missing after non-admin update/delete attempts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'media'
      AND name = 'platform/blog/platform-admin-can-upload.txt'
  ) THEN
    RAISE EXCEPTION 'platform storage object missing after non-admin update/delete attempts';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.blog_posts (
      merchant_id,
      title,
      slug,
      content,
      author_name,
      status,
      is_platform_post,
      published_at
    )
    VALUES (
      NULL,
      'Anon should not create platform post',
      'anon-should-not-create-platform-post',
      'blocked',
      'Anon',
      'published',
      true,
      now()
    );

    RAISE EXCEPTION 'anon unexpectedly inserted platform blog post';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  UPDATE public.blog_posts
  SET title = 'Anon should not update platform post'
  WHERE slug = 'platform-admin-can-create-platform-post';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'anon unexpectedly updated platform blog post';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  DELETE FROM public.blog_posts
  WHERE slug = 'platform-admin-can-create-platform-post';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'anon unexpectedly deleted platform blog post';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('media', 'platform/blog/anon-should-not-upload.txt');

    RAISE EXCEPTION 'anon unexpectedly uploaded platform blog media';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  UPDATE storage.objects
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"attempted_by":"anon"}'::jsonb
  WHERE bucket_id = 'media'
    AND name = 'platform/blog/platform-admin-can-upload.txt';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'anon unexpectedly updated platform blog media object';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  affected_rows bigint := 0;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'media'
    AND name = 'platform/blog/platform-admin-can-upload.txt';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'anon unexpectedly deleted platform blog media object';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

ROLLBACK;
