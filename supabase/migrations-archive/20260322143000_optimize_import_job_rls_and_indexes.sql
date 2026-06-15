CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by
  ON public.import_jobs (created_by);

CREATE INDEX IF NOT EXISTS idx_orders_import_job_id
  ON public.orders (import_job_id)
  WHERE import_job_id IS NOT NULL;

DROP POLICY IF EXISTS "Merchants can view import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can view import jobs"
ON public.import_jobs
FOR SELECT
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = (SELECT auth.uid())
  )
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can create import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can create import jobs"
ON public.import_jobs
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = (SELECT auth.uid())
  )
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can update import jobs" ON public.import_jobs;
CREATE POLICY "Merchants can update import jobs"
ON public.import_jobs
FOR UPDATE
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = (SELECT auth.uid())
  )
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
)
WITH CHECK (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = (SELECT auth.uid())
  )
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
);

DROP POLICY IF EXISTS "Merchants can view import job rows" ON public.import_job_rows;
CREATE POLICY "Merchants can view import job rows"
ON public.import_job_rows
FOR SELECT
USING (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = (SELECT auth.uid())
  )
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
);
