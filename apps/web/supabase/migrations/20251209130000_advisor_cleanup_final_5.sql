-- Phase 8: Persistent Duplicates Cleanup
-- 1. Performance: Remove duplicate policy on `loyalty_rewards`

-- Confirmed duplicate via SQL:
-- "Merchants can manage loyalty rewards" (Old)
-- "Merchants can manage their loyalty rewards" (New, Optimized)

DROP POLICY IF EXISTS "Merchants can manage loyalty rewards" ON loyalty_rewards;
