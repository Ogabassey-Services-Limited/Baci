-- A legacy import stored a percent-encoded non-breaking hyphen as a slug.
-- Public requests for it decode to Unicode and fail Vercel remote-cache reads.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.blog_posts AS target
    JOIN public.merchants AS merchant ON merchant.id = target.merchant_id
    JOIN public.blog_posts AS conflicting
      ON conflicting.merchant_id = target.merchant_id
     AND conflicting.slug = 'wwdc-2025-5-game-changing-apple-announcements'
     AND conflicting.id <> target.id
    WHERE merchant.slug = 'ogabassey'
      AND target.slug = 'wwdc-2025-5-game%e2%80%91changing-apple-announcements'
  ) THEN
    RAISE EXCEPTION 'Cannot normalize Ogabassey WWDC blog slug: canonical slug already exists';
  END IF;

  UPDATE public.blog_posts AS post
  SET slug = 'wwdc-2025-5-game-changing-apple-announcements',
      updated_at = now()
  FROM public.merchants AS merchant
  WHERE merchant.id = post.merchant_id
    AND merchant.slug = 'ogabassey'
    AND post.slug = 'wwdc-2025-5-game%e2%80%91changing-apple-announcements';
END;
$$;
