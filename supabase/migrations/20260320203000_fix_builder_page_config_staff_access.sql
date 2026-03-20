-- Align page builder RLS with the app's `builder` permission model.
-- This keeps page config access tenant-scoped while allowing authorized staff
-- to load and edit builder drafts for their assigned merchant.

DROP POLICY IF EXISTS "Staff can view page configs" ON public.page_configs;
CREATE POLICY "Staff can view page configs" ON public.page_configs
  FOR SELECT TO public
  USING (
    check_staff_permission((SELECT auth.uid()), merchant_id, 'builder', 'view')
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'builder', 'edit')
  );

DROP POLICY IF EXISTS "Staff can insert page configs" ON public.page_configs;
CREATE POLICY "Staff can insert page configs" ON public.page_configs
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'builder', 'edit')
  );

DROP POLICY IF EXISTS "Staff can update page configs" ON public.page_configs;
CREATE POLICY "Staff can update page configs" ON public.page_configs
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'builder', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete page configs" ON public.page_configs;
CREATE POLICY "Staff can delete page configs" ON public.page_configs
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'builder', 'edit')
  );
