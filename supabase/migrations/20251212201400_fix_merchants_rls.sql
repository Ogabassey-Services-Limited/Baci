-- Enable RLS on merchants table (ensure it's on)
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- 1. Allow authenticated users to view their own merchant record
DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;
CREATE POLICY "Users can view their own merchant"
ON public.merchants FOR SELECT
USING (auth.uid() = user_id);

-- 2. Allow authenticated users to update their own merchant record
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;
CREATE POLICY "Users can update their own merchant"
ON public.merchants FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Allow staff members to view merchants they belong to
-- Note: Staff logic typically queries staff_members table first to find the merchant_id.
-- However, for simple "get merchant" queries where RLS applies, we might need policy for staff too.
-- But 'getMerchantForUser' queries 'staff_members' table to get the merchant data directly via join.
-- If querying 'merchants' table as a staff member (e.g. from dashboard), we need permission.
DROP POLICY IF EXISTS "Staff can view their merchant" ON public.merchants;
CREATE POLICY "Staff can view their merchant"
ON public.merchants FOR SELECT
USING (
  id IN (
    SELECT merchant_id 
    FROM staff_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
