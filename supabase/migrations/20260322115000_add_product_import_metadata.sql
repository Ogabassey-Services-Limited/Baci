ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_import_job_id
  ON public.products (import_job_id);

COMMENT ON COLUMN public.products.import_job_id IS
  'Most recent import job that created or updated this imported product; maintained by application code during import writes.';
COMMENT ON COLUMN public.products.imported_at IS
  'Timestamp when the product was first imported from an external platform.';
