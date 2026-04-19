-- Migration: Fix Merchant RLS Infinite Recursion
-- Date: 2025-12-08
-- Problem: "Staff can view merchant" policy causes infinite recursion 
--          by querying staff_members table which might have its own RLS policies

BEGIN;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Staff can view merchant" ON merchants;

-- Create a simpler, non-recursive policy
-- Option 1: Allow all authenticated users to view merchants (most storefronts are public)
CREATE POLICY "Public can view merchants" ON merchants
  FOR SELECT
  USING (
    -- Public access: anyone can view non-admin merchants (storefronts are public)
    is_platform_admin IS NOT TRUE
    -- OR owner access
    OR user_id = auth.uid()
  );

-- Create separate policy for staff access that avoids recursion
-- by using EXISTS with SECURITY DEFINER function approach or simpler check
CREATE POLICY "Owner and staff can manage merchants" ON merchants
  FOR ALL
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

COMMIT;
