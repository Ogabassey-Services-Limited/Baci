-- Drop the redundant "Consolidated view permissions" SELECT policy on merchants.
--
-- Why: "Public can view merchants" already uses `USING (true)`, which grants
-- universal read access. Since both policies are PERMISSIVE (OR logic),
-- the complex "Consolidated view permissions" policy runs on every query
-- but never changes the outcome — true OR anything = true.
--
-- The get_user_merchant_access() call inside the redundant policy adds
-- measurable overhead per-row for no functional benefit.
--
-- Supabase advisor flagged this as: multiple_permissive_policies (WARN)

DROP POLICY IF EXISTS "Consolidated view permissions" ON merchants;;
