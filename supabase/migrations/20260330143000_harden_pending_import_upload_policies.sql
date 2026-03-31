CREATE INDEX IF NOT EXISTS idx_pending_import_uploads_created_by
  ON public.pending_import_uploads (created_by);

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
  OR (
    entity_type = 'orders'
    AND check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  )
  OR (
    entity_type = 'products'
    AND check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
  )
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
  OR (
    entity_type = 'orders'
    AND check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  )
  OR (
    entity_type = 'products'
    AND check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
  )
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
  OR (
    entity_type = 'orders'
    AND check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  )
  OR (
    entity_type = 'products'
    AND check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
  )
)
WITH CHECK (
  merchant_id IN (
    SELECT id
    FROM public.merchants
    WHERE user_id = auth.uid()
  )
  OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  OR (
    entity_type = 'orders'
    AND check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  )
  OR (
    entity_type = 'products'
    AND check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
  )
);
