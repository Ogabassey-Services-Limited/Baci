-- Phase 10: Comprehensive Policy Consolidation
-- 1. Fix Customers: Remove duplicate SELECT and UPDATE policies
-- 2. Fix Loyalty Airtime Rewards: Remove Merchants policy for anon role

-- 1. CUSTOMERS: Consolidate policies
-- Identified duplicates:
-- SELECT: "Customers can view their own data" vs "customers_select_policy"
-- UPDATE: "Customers can update their own data" vs "customers_update_policy"

-- Remove redundant named policies (keep the snake_case ones which are more comprehensive)
DROP POLICY IF EXISTS "Customers can view their own data" ON customers;
DROP POLICY IF EXISTS "Customers can update their own data" ON customers;

-- 2. LOYALTY_AIRTIME_REWARDS: Fix anon overlap
-- Problem: "Merchants can manage their airtime rewards" FOR ALL applies to anon too.
-- Solution: Restrict Merchants policy to authenticated role only.
DROP POLICY IF EXISTS "Merchants can manage their airtime rewards" ON loyalty_airtime_rewards;
CREATE POLICY "Merchants can manage their airtime rewards" ON loyalty_airtime_rewards
FOR ALL TO authenticated
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));
