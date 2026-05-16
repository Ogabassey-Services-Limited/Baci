-- Platform blog foundation:
-- - Enforce unique slugs for platform posts (`merchant_id IS NULL` rows)
-- - Allow platform admins to write platform posts on `public.blog_posts`
-- - Drop legacy `public.platform_blog_posts` only when empty
-- - Allow platform admins to manage media objects under `media/platform/blog/...`

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_platform_slug_unique
ON public.blog_posts (slug)
WHERE is_platform_post IS TRUE
  AND merchant_id IS NULL;

DROP POLICY IF EXISTS "Platform admins can insert platform blog posts"
ON public.blog_posts;
CREATE POLICY "Platform admins can insert platform blog posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can update platform blog posts"
ON public.blog_posts;
CREATE POLICY "Platform admins can update platform blog posts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
)
WITH CHECK (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can delete platform blog posts"
ON public.blog_posts;
CREATE POLICY "Platform admins can delete platform blog posts"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (
  is_platform_post IS TRUE
  AND merchant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DO $$
DECLARE
  platform_blog_post_count bigint := 0;
BEGIN
  IF to_regclass('public.platform_blog_posts') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.platform_blog_posts'
      INTO platform_blog_post_count;

    IF platform_blog_post_count <> 0 THEN
      RAISE EXCEPTION
        'Refusing to drop public.platform_blog_posts because it contains % rows',
        platform_blog_post_count;
    END IF;
  END IF;
END
$$;

DROP TABLE IF EXISTS public.platform_blog_posts CASCADE;

DROP POLICY IF EXISTS "Platform admins can upload platform blog media"
ON storage.objects;
CREATE POLICY "Platform admins can upload platform blog media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can update platform blog media"
ON storage.objects;
CREATE POLICY "Platform admins can update platform blog media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
)
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);

DROP POLICY IF EXISTS "Platform admins can delete platform blog media"
ON storage.objects;
CREATE POLICY "Platform admins can delete platform blog media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'platform'
  AND (storage.foldername(name))[2] = 'blog'
  AND EXISTS (
    SELECT 1
    FROM public.merchants
    WHERE merchants.user_id = auth.uid()
      AND merchants.is_platform_admin IS TRUE
  )
);
