-- Fix anonymous cross-tenant data leaks on checkout_sessions and negotiation_requests.
--
-- Both tables have `GRANT ALL TO anon` and RLS enabled, so access is governed
-- entirely by their policies. Three real issues were found in the baseline:
--
--   1. checkout_sessions: "Allow public read by session_id" is FOR SELECT
--      USING (true) with NO `TO` clause, so it applies to PUBLIC (incl. anon).
--      The table stores customer_email/name/phone, shipping_address,
--      payment_reference and virtual_account_number/bank/name. Any anonymous
--      visitor could read every checkout session across all merchants.
--      All real reads go through the service-role admin client (RLS-bypassing)
--      or the scoped `Agentic checkout sessions are readable by scoped client`
--      (TO authenticated) policy, so dropping the broad policy is non-breaking.
--
--   2. negotiation_requests: "Users can view negotiation requests" includes the
--      term `(session_id IS NOT NULL)` with NO `TO` clause. session_id is a
--      NOT NULL column, so that term is a tautology -> every row is readable by
--      anon. The storefront only INSERTs negotiation requests (never reads them
--      back in the browser); merchant/customer reads use the other branches.
--
--   3. The staff branch of both the SELECT and UPDATE policies used
--      `WHERE s.merchant_id = s.merchant_id` (a self-comparison that is always
--      true), so any authenticated staff member of ANY merchant could read or
--      update ANY merchant's negotiation requests. Replaced with the canonical
--      `has_merchant_access(merchant_id)` helper (owner OR active staff of THAT
--      merchant), which is already used by 32 other policies.
--
-- Best practices applied (Supabase RLS docs): every policy specifies an explicit
-- `TO` role (anon short-circuits) and `(SELECT auth.uid())` is used so the
-- planner caches it as an initPlan.

-- 1. checkout_sessions: remove the broad anonymous SELECT policy.
DROP POLICY IF EXISTS "Allow public read by session_id" ON public.checkout_sessions;

-- 2 + 3. negotiation_requests: rebuild SELECT without the anon tautology and
--        with the corrected staff/owner access check.
DROP POLICY IF EXISTS "Users can view negotiation requests" ON public.negotiation_requests;
CREATE POLICY "Users can view negotiation requests"
  ON public.negotiation_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = customer_id
    OR public.has_merchant_access(merchant_id)
  );

-- 3. negotiation_requests: fix the broken staff self-join on the UPDATE policy.
DROP POLICY IF EXISTS "Merchants can update their own negotiation requests" ON public.negotiation_requests;
CREATE POLICY "Merchants can update their own negotiation requests"
  ON public.negotiation_requests
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_merchant_access(merchant_id));
