-- Phase 9: Exhaustive Warning Resolution
-- Fix "Multiple Permissive Policies" on loyalty_airtime_rewards by scoping "Public" policy to anon role only.

-- Current state:
-- "Merchants can manage their airtime rewards" FOR ALL (applies to authenticated)
-- "Public can view active airtime rewards" FOR SELECT (applies to all roles - causing overlap with authenticated)

-- Fix: Restrict "Public" policy to anon role only, so authenticated users use only the Merchant policy.
DROP POLICY IF EXISTS "Public can view active airtime rewards" ON loyalty_airtime_rewards;
CREATE POLICY "Public can view active airtime rewards" ON loyalty_airtime_rewards
FOR SELECT TO anon
USING (is_active = true);
