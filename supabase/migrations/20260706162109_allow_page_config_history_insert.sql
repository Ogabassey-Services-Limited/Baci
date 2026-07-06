-- Allow authenticated merchant/staff publishers to archive the previously
-- published builder config when publishing a new draft.
--
-- Existing RLS allowed staff to SELECT page_config_history rows through the
-- parent page_configs.merchant_id, but there was no INSERT policy. The builder
-- publish route updates page_configs successfully, then attempts to insert the
-- old published_config into page_config_history with the same authenticated
-- Supabase session; without this policy PostgREST returns 42501.
--
-- Scoped with check_staff_permission(builder, edit) rather than the broader
-- has_merchant_access: the publish route requires the builder.edit permission
-- (hasPermission(access, 'builder', 'edit')), so the DB policy mirrors it.
-- check_staff_permission returns TRUE for the merchant owner and otherwise
-- requires the staff member's effective permissions to grant builder.edit —
-- staff roles without builder access (e.g. sales_rep) cannot insert history
-- rows via direct PostgREST writes.

DROP POLICY IF EXISTS "Staff can insert page config history" ON public.page_config_history;

CREATE POLICY "Staff can insert page config history"
ON public.page_config_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.page_configs
    WHERE page_configs.id = page_config_history.page_config_id
      AND public.check_staff_permission(
        (SELECT auth.uid()),
        page_configs.merchant_id,
        'builder',
        'edit'
      )
  )
);
