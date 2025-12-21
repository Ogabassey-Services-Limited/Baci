-- Migration: Fix Merchant RLS Access
-- Date: 2025-12-07
-- Description: Ensure public access to merchant data by handling NULL values in is_platform_admin

-- 1. Fix any existing NULL values
UPDATE merchants SET is_platform_admin = FALSE WHERE is_platform_admin IS NULL;

-- 2. Make the column NOT NULL to prevent future issues
ALTER TABLE merchants ALTER COLUMN is_platform_admin SET DEFAULT FALSE;
-- note: we don't strict enforce NOT NULL constraint immediately to avoid potential locking issues on large tables, 
-- but setting default ensures new rows are correct.

-- 3. Update the RLS policy to be more robust (using COALESCE or IS NOT TRUE)
-- First drop the old policy
DROP POLICY IF EXISTS "Staff can view merchant" ON merchants;

-- Recreate with robust NULL handling
CREATE POLICY "Staff can view merchant" ON merchants
  FOR SELECT USING (
    user_id = auth.uid() -- Owner
    OR id IN (SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active')
    -- Allow public access if is_platform_admin is false OR null
    OR (is_platform_admin IS NOT TRUE)
  );
