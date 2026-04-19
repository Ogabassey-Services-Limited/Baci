CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('bumpa')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('orders', 'products')),
  status TEXT NOT NULL CHECK (
    status IN (
      'uploaded',
      'validating',
      'preview_ready',
      'commit_queued',
      'committing',
      'committed',
      'notify_queued',
      'notifying',
      'completed',
      'failed'
    )
  ),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  file_size_bytes BIGINT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  committed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_job_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  source_external_id TEXT,
  row_status TEXT NOT NULL CHECK (
    row_status IN ('create', 'update', 'duplicate', 'invalid')
  ),
  source_payload JSONB NOT NULL,
  normalized_payload JSONB,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_job_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_merchant_created_at
  ON public.import_jobs (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status_created_at
  ON public.import_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_row_number
  ON public.import_job_rows (import_job_id, row_number);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_merchant_status
  ON public.import_job_rows (merchant_id, row_status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can view import jobs"
ON public.import_jobs
FOR SELECT
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can create import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can create import jobs"
ON public.import_jobs
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can update import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can update import jobs"
ON public.import_jobs
FOR UPDATE
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
)
WITH CHECK (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can view import job rows" ON public.import_job_rows;
CREATE POLICY "Merchants can view import job rows"
ON public.import_job_rows
FOR SELECT
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
);

DROP TRIGGER IF EXISTS trigger_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER trigger_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_import_job_rows_updated_at ON public.import_job_rows;
CREATE TRIGGER trigger_import_job_rows_updated_at
BEFORE UPDATE ON public.import_job_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_merchant_external_source_id
  ON public.orders (merchant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_merchant_external_source_id
  ON public.products (merchant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

COMMENT ON TABLE public.import_jobs IS
  'Queued merchant import jobs for Bumpa migration uploads.';
COMMENT ON TABLE public.import_job_rows IS
  'Row-level preview and validation results for merchant migration jobs.';
COMMENT ON COLUMN public.orders.external_source IS
  'External platform source for imported orders, e.g. bumpa.';
COMMENT ON COLUMN public.orders.external_id IS
  'Stable external identifier from the imported order source.';
COMMENT ON COLUMN public.orders.import_job_id IS
  'Latest import job that created or updated this imported order.';
