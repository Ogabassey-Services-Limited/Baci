-- Phase 6: Advisor Cleanup (Final)
-- 1. Security: Fix mutable search paths for remaining functions (Specific Signatures)
-- 2. Performance: Optimize Loyalty & VTU RLS
-- 3. Performance: Consolidate Merchants RLS

-- 1. Security: Fix Mutable Search Paths

-- complete_wallet_withdrawal
ALTER FUNCTION public.complete_wallet_withdrawal(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.complete_wallet_withdrawal(uuid, boolean, text, text) SET search_path = public;

-- credit_merchant_wallet
ALTER FUNCTION public.credit_merchant_wallet(uuid, bigint, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.credit_merchant_wallet(uuid, numeric, text, text, text) SET search_path = public;
ALTER FUNCTION public.credit_merchant_wallet(uuid, numeric, text, uuid, text) SET search_path = public;

-- debit_merchant_wallet
ALTER FUNCTION public.debit_merchant_wallet(uuid, numeric, text, text) SET search_path = public;
ALTER FUNCTION public.debit_merchant_wallet(uuid, bigint, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.debit_merchant_wallet(uuid, numeric, text, text, text) SET search_path = public;

-- get_wallet_summary
ALTER FUNCTION public.get_wallet_summary(uuid) SET search_path = public;

-- record_merchant_settlement
ALTER FUNCTION public.record_merchant_settlement(uuid, bigint, text, text, text) SET search_path = public;
ALTER FUNCTION public.record_merchant_settlement(uuid, text, uuid, text, text, numeric, numeric, numeric, text) SET search_path = public;

-- get_total_sales (No args)
ALTER FUNCTION public.get_total_sales() SET search_path = public;


-- 2. Performance: Optimize Loyalty Tables (Cache auth.uid())

-- loyalty_airtime_rewards
DROP POLICY IF EXISTS "Merchants can manage their airtime rewards" ON loyalty_airtime_rewards;
CREATE POLICY "Merchants can manage their airtime rewards" ON loyalty_airtime_rewards
FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- loyalty_rewards
DROP POLICY IF EXISTS "Merchants can manage their loyalty rewards" ON loyalty_rewards;
CREATE POLICY "Merchants can manage their loyalty rewards" ON loyalty_rewards
FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- loyalty_settings (Found in DB)
DROP POLICY IF EXISTS "Merchants can manage their loyalty settings" ON loyalty_settings;
CREATE POLICY "Merchants can manage their loyalty settings" ON loyalty_settings
FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));


-- VTU Transactions: Fix UPDATE policy
DROP POLICY IF EXISTS "Merchants can update their own VTU transactions" ON vtu_transactions;
CREATE POLICY "Merchants can update their own VTU transactions" ON vtu_transactions
FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));


-- 3. Performance: Consolidate Merchants RLS
-- Advisor: "Multiple permissive policies for role dashboard_user for action SELECT"
DROP POLICY IF EXISTS "Allow read access on merchants" ON merchants;

-- Advisor: "Multiple permissive policies for role dashboard_user for action UPDATE"
DROP POLICY IF EXISTS "Allow owners to update their own merchant data" ON merchants;
