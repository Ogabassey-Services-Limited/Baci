-- Fix: Platform admin merchant was invisible to its owner due to blanket RLS policy.
-- The old policy `(is_platform_admin IS NOT TRUE)` blocked the admin's own merchant
-- from authenticated queries, causing redirect to /onboarding instead of /dashboard.
--
-- Split into two role-specific policies per Supabase best practices:
-- 1. Anon: see non-admin merchants only (skips auth.uid() evaluation)
-- 2. Authenticated: owner always sees own merchant + all non-admin merchants

-- Drop the old blanket policy
DROP POLICY IF EXISTS "Public can view merchants" ON merchants;

-- Anon users: see non-admin merchants only (no auth.uid() evaluation)
CREATE POLICY "Anon can view merchants" ON merchants
  FOR SELECT
  TO anon
  USING (is_platform_admin IS NOT TRUE);

-- Authenticated users: see own merchant + all non-admin merchants
CREATE POLICY "Authenticated can view merchants" ON merchants
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (is_platform_admin IS NOT TRUE)
  );
