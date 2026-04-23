-- Add missing SEO metadata columns for builder drafts and published page configs.
-- The builder API already reads/writes these fields; without them publish requests
-- fail with a PostgREST column error and surface as HTTP 500s in the admin app.

ALTER TABLE public.page_configs
ADD COLUMN IF NOT EXISTS draft_seo JSONB DEFAULT NULL;

ALTER TABLE public.page_configs
ADD COLUMN IF NOT EXISTS published_seo JSONB DEFAULT NULL;

COMMENT ON COLUMN public.page_configs.draft_seo IS
  'Draft SEO metadata edited in the page builder.';

COMMENT ON COLUMN public.page_configs.published_seo IS
  'Published SEO metadata served by the page builder.';
