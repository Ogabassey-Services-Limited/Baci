-- Optimizing RLS policies for vtu_transactions to fix performance warnings
-- Pattern: Replace auth.uid() with (SELECT auth.uid()) to allow query plan caching

DROP POLICY IF EXISTS "Merchants can view their own VTU transactions" ON vtu_transactions;
CREATE POLICY "Merchants can view their own VTU transactions" ON vtu_transactions
FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Merchants can insert VTU transactions" ON vtu_transactions;
CREATE POLICY "Merchants can insert VTU transactions" ON vtu_transactions
FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));
