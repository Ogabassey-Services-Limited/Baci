-- Phase 7: Final RLS Polish
-- 1. Performance: Optimize Wallet Transactions RLS
-- 2. Performance: Optimize Merchant Settlements RLS
-- 3. Performance: Fix Merchants Policy Redundancy (Split Owner Policy)

-- 1. Wallet Transactions (Cache auth.uid())
DROP POLICY IF EXISTS "Merchants can view their own transactions" ON wallet_transactions;
CREATE POLICY "Merchants can view their own transactions" ON wallet_transactions
FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- 2. Merchant Settlements (Cache auth.uid())
DROP POLICY IF EXISTS "Merchants can view their own settlements" ON merchant_settlements;
CREATE POLICY "Merchants can view their own settlements" ON merchant_settlements
FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- 3. Merchants: Split "Owner and staff can manage merchants" to remove SELECT redundancy
-- Existing "Public can view merchants" covers SELECT.
-- We restrict Owner policy to INSERT, UPDATE, DELETE only.

DROP POLICY IF EXISTS "Owner and staff can manage merchants" ON merchants;

CREATE POLICY "Owner and staff can modify merchants" ON merchants
FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner and staff can update merchants" ON merchants
FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner and staff can delete merchants" ON merchants
FOR DELETE USING (user_id = (SELECT auth.uid()));
