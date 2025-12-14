-- Applied via Supabase MCP to clear remaining advisor warnings
-- Timestamp: 2025-12-14 (Batch 2)

-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Public can view published merchants" ON public.merchants;
DROP POLICY IF EXISTS "Allow users to view their associated merchants" ON public.merchants;

CREATE POLICY "Consolidated view permissions" ON public.merchants
FOR SELECT USING (
  is_published = true
  OR
  id IN (
    SELECT get_user_merchant_access.merchant_id
    FROM get_user_merchant_access((SELECT auth.uid()))
  )
);

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Owner and staff can update merchants" ON public.merchants;
DROP POLICY IF EXISTS "Allow staff to update merchant" ON public.merchants;

CREATE POLICY "Consolidated update permissions" ON public.merchants
FOR UPDATE USING (
  user_id = (SELECT auth.uid())
  OR
  check_staff_permission((SELECT auth.uid()), id, 'settings', 'edit')
);

-- Drop Unused Indexes (INFO level)
DROP INDEX IF EXISTS idx_merchants_is_published;
DROP INDEX IF EXISTS idx_merchant_feature_settings_credit_direct_enabled;
DROP INDEX IF EXISTS idx_notifications_template_id;
DROP INDEX IF EXISTS idx_vtu_transactions_customer;
