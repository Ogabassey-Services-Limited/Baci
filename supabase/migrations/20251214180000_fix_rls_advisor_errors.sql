-- Applied via Supabase MCP to fix advisor errors
-- Timestamp: 2025-12-14

-- 1. Drop redundant policy
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;

-- 2. Optimize "Allow users to view their associated merchants"
DROP POLICY IF EXISTS "Allow users to view their associated merchants" ON public.merchants;
CREATE POLICY "Allow users to view their associated merchants" ON public.merchants
FOR SELECT USING (
  id IN (
    SELECT get_user_merchant_access.merchant_id
    FROM get_user_merchant_access((SELECT auth.uid()))
  )
);

-- 3. Optimize "Allow staff to update merchant"
DROP POLICY IF EXISTS "Allow staff to update merchant" ON public.merchants;
CREATE POLICY "Allow staff to update merchant" ON public.merchants
FOR UPDATE USING (
  check_staff_permission((SELECT auth.uid()), id, 'settings', 'edit')
);
