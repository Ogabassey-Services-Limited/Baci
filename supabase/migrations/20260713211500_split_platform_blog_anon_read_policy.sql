-- Keep the anonymous platform-blog read guard independent from private
-- merchants.is_platform_admin after merchant column privileges were narrowed.
BEGIN;

ALTER POLICY "Platform blog posts require published status or admin read"
  ON public.blog_posts
  TO authenticated;

DROP POLICY IF EXISTS "Anon platform blog posts require published status"
  ON public.blog_posts;
CREATE POLICY "Anon platform blog posts require published status"
  ON public.blog_posts
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (
    is_platform_post IS NOT TRUE
    OR (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND status = 'published'::text
      AND published_at IS NOT NULL
    )
  );

COMMIT;
