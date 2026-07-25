-- ============================================================================
-- P0 FIX: mobile merchant signup 500 -- INSERT ... RETURNING on public.merchants
--         is rejected by the authenticated SELECT policy
-- ============================================================================
-- SYMPTOM (prod, 2026-07-22 -> 2026-07-25): every merchant registration from
-- apps/mobile-admin failed with "Registration Failed / Internal Server Error".
-- The auth user WAS created, the merchant row was NOT, leaving orphaned users
-- who then hit the 409 "account exists" path on retry. Postgres logged
-- `42501 new row violates row-level security policy for table "merchants"` for
-- each attempt. Last successful mobile signup: 2026-07-11.
--
-- ROOT CAUSE
-- 20260722150000_s1_merchants_authenticated_containment.sql tightened the
-- authenticated SELECT policy to:
--
--     USING (is_published IS TRUE OR public.has_merchant_access(id))
--
-- Its own comment states the intent as "own row OR published OR a merchant this
-- user actively staffs", but the owner branch stopped being a predicate over the
-- row's OWN columns and became a self-lookup: has_merchant_access(id) re-queries
-- public.merchants for that id.
--
-- PostgreSQL applies SELECT policies to INSERT when the statement carries a
-- RETURNING clause, and evaluates them as WITH CHECK options against the
-- candidate tuple BEFORE it is visible to a scan. So for a brand-new merchant:
--   * is_published defaults to false        -> branch 1 false
--   * has_merchant_access(<new id>) finds no row yet -> branch 2 false
-- ...and the INSERT is rejected. api/mobile-onboarding does
-- `.insert({...}).select('id, slug').single()`, i.e. INSERT ... RETURNING, so
-- merchant creation could never succeed for the owner's own authenticated
-- client. UPDATE ... RETURNING was unaffected (the row already exists), which is
-- why profile completion for EXISTING merchants kept working and masked this.
--
-- The web onboarding path (app/(platform)/onboarding/actions.ts) inserts with
-- the service-role client, which bypasses RLS -- hence web signup stayed green.
--
-- FIX
-- Restore the owner branch as a tuple-local predicate. `user_id = auth.uid()`
-- reads the candidate row's own column, so it is satisfiable at INSERT-RETURNING
-- time.
--
-- NOT A WIDENING: for any row that already exists, `user_id = auth.uid()` is
-- exactly the first EXISTS inside has_merchant_access(id), so this branch admits
-- no row that the policy did not already admit. It only makes the owner check
-- evaluable before the row is scannable. Draft-store enumeration by other
-- signed-in users stays closed: a non-owner still falls through to
-- has_merchant_access.
--
-- The recursion constraint from the S1 incident note is preserved: this adds a
-- plain column comparison, NOT an inline EXISTS over public.staff_members, so
-- the merchants -> staff_members -> merchants 42P17 cycle is not reintroduced.
--
-- Idempotent and re-runnable; ALTER POLICY replaces the USING expression.
-- ============================================================================

ALTER POLICY "Authenticated can view merchants"
  ON public.merchants
  USING (
    is_published IS TRUE
    -- Owner, evaluated on the candidate row itself. Required for
    -- INSERT ... RETURNING (signup); redundant-but-harmless for existing rows.
    OR user_id = (SELECT auth.uid())
    OR public.has_merchant_access(id)
  );

COMMENT ON POLICY "Authenticated can view merchants" ON public.merchants IS
  'Authenticated read scope: published stores, the caller''s own merchant row '
  '(tuple-local so INSERT ... RETURNING at signup can pass), or a merchant the '
  'caller owns/actively staffs via has_merchant_access. Do not collapse the '
  'user_id branch back into has_merchant_access: that re-queries merchants by '
  'id and cannot be satisfied by a not-yet-visible row (see the 2026-07-25 '
  'mobile signup outage).';
