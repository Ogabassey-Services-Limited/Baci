-- Phase 7.5: Final Sweep
-- 1. Performance: Optimize Merchant Daily Counters RLS
-- 2. Performance: Optimize Order Insurance Policies RLS
-- 3. Performance: Remove Redundant Loyalty Settings Policy

-- 1. Merchant Daily Counters
-- Advisor flagged: "merchant_daily_counters_merchant_access" has auth.uid() re-evaluation
DROP POLICY IF EXISTS "merchant_daily_counters_merchant_access" ON merchant_daily_counters;
CREATE POLICY "merchant_daily_counters_merchant_access" ON merchant_daily_counters
FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- 2. Order Insurance Policies
-- Advisor flagged: "Merchants can view their order insurance policies" has auth.uid() re-evaluation
DROP POLICY IF EXISTS "Merchants can view their order insurance policies" ON order_insurance_policies;
CREATE POLICY "Merchants can view their order insurance policies" ON order_insurance_policies
FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- 3. Loyalty Settings Redundancy
-- Advisor flagged duplicate policies: "Merchants can manage loyalty settings" vs "Merchants can manage their loyalty settings" (mine).
-- Dropping the old one.
DROP POLICY IF EXISTS "Merchants can manage loyalty settings" ON loyalty_settings;
