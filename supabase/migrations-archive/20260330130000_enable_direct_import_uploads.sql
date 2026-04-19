ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS client_upload_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_jobs_merchant_client_upload_id
  ON public.import_jobs (merchant_id, client_upload_id)
  WHERE client_upload_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pending_import_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_upload_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('bumpa')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('orders', 'products')),
  original_filename TEXT NOT NULL,
  content_type TEXT,
  file_size_bytes BIGINT,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, client_upload_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_import_uploads_expires_at
  ON public.pending_import_uploads (expires_at)
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_import_uploads_merchant_created_at
  ON public.pending_import_uploads (merchant_id, created_at DESC);

ALTER TABLE public.pending_import_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view pending import uploads" ON public.pending_import_uploads;
CREATE POLICY "Merchants can view pending import uploads"
ON public.pending_import_uploads
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

DROP POLICY IF EXISTS "Merchants can create pending import uploads" ON public.pending_import_uploads;
CREATE POLICY "Merchants can create pending import uploads"
ON public.pending_import_uploads
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

DROP POLICY IF EXISTS "Merchants can update pending import uploads" ON public.pending_import_uploads;
CREATE POLICY "Merchants can update pending import uploads"
ON public.pending_import_uploads
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

COMMENT ON COLUMN public.import_jobs.client_upload_id IS
  'Idempotency key returned by upload-init and consumed by finalize-import-job.';
COMMENT ON TABLE public.pending_import_uploads IS
  'Tracks direct-to-storage migration uploads until a matching import job claims them.';
