-- Fix infinite recursion by using SECURITY DEFINER function for access check

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- Drop the potentially recursive policies
DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Staff can view their merchant" ON public.merchants;
DROP POLICY IF EXISTS "Access own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Allow users to view their associated merchants" ON public.merchants;

-- Create single unified policy using the security definer function
-- This avoids the recursion because the function runs with elevated privileges
-- and doesn't trigger the RLS check on staff_members -> merchants cycle.
CREATE POLICY "Allow users to view their associated merchants"
ON public.merchants FOR SELECT
USING (
  id IN (
    SELECT merchant_id FROM get_user_merchant_access(auth.uid())
  )
);

-- Policy for updating merchant settings (Logo upload triggers this indirectly if metadata is updated? No, storage is separate)
-- But ensuring UPDATE works for owner is critical.
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;
CREATE POLICY "Users can update their own merchant"
ON public.merchants FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for staff updating merchant settings
DROP POLICY IF EXISTS "Allow staff to update merchant" ON public.merchants;
CREATE POLICY "Allow staff to update merchant"
ON public.merchants FOR UPDATE
USING (
  check_staff_permission(auth.uid(), id, 'settings', 'edit')
);
