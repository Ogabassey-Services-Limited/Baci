-- Phase 6.5: Advisor Cleanup (Part 2)
-- 1. Security: Fix mutable search paths for remaining verified functions
-- 2. Performance: Optimize Merchant Wallets RLS
-- 3. Performance: Remove redundant Merchants INSERT policy

-- 1. Security: Fix Mutable Search Paths
ALTER FUNCTION public.calculate_settlement_date(text, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_monthly_sales_stats(uuid) SET search_path = public;
ALTER FUNCTION public.process_due_settlements() SET search_path = public;
ALTER FUNCTION public.update_settlement_updated_at() SET search_path = public;
ALTER FUNCTION public.update_wallet_updated_at() SET search_path = public;

-- 2. Performance: Optimize Merchant Wallets RLS (Cache auth.uid())
DROP POLICY IF EXISTS "Merchants can view their own wallet" ON merchant_wallets;
CREATE POLICY "Merchants can view their own wallet" ON merchant_wallets
FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Merchants can update their wallet settings" ON merchant_wallets;
CREATE POLICY "Merchants can update their wallet settings" ON merchant_wallets
FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- 3. Performance: Remove Redundant Merchants Policies
-- Advisor: "Multiple permissive policies for role dashboard_user for action INSERT"
DROP POLICY IF EXISTS "Allow owners to insert their own merchant data" ON merchants;
