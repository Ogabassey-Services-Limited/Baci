CREATE TABLE IF NOT EXISTS public.blog_post_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  source_slug text NOT NULL,
  target_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_post_redirects_source_slug_not_blank CHECK (btrim(source_slug) <> ''),
  CONSTRAINT blog_post_redirects_source_slug_normalized CHECK (source_slug = lower(btrim(source_slug))),
  UNIQUE (merchant_id, source_slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_redirects_target_post
  ON public.blog_post_redirects (target_post_id);

ALTER TABLE public.blog_post_redirects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blog_post_redirects'
      AND policyname = 'Public can read blog post redirects'
  ) THEN
    CREATE POLICY "Public can read blog post redirects"
      ON public.blog_post_redirects
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blog_post_redirects'
      AND policyname = 'Service role can manage blog post redirects'
  ) THEN
    CREATE POLICY "Service role can manage blog post redirects"
      ON public.blog_post_redirects
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_blog_post_redirects_updated_at'
      AND tgrelid = 'public.blog_post_redirects'::regclass
  ) THEN
    CREATE TRIGGER trigger_blog_post_redirects_updated_at
      BEFORE UPDATE ON public.blog_post_redirects
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

GRANT SELECT ON public.blog_post_redirects TO anon, authenticated;
GRANT ALL ON public.blog_post_redirects TO service_role;
