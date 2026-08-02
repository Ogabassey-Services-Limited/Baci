-- =============================================
-- REGRESSION TEST: merchant signup INSERT ... RETURNING under RLS
--   Locks the fix in migration
--   20260725170000_restore_merchant_owner_row_select_branch.sql
--
-- BUG (prod 2026-07-22 -> 2026-07-25): the authenticated SELECT policy on
-- public.merchants was `is_published IS TRUE OR has_merchant_access(id)`.
-- Postgres applies SELECT policies to INSERT statements that carry RETURNING,
-- evaluating them against the candidate tuple BEFORE it is scannable, so a
-- brand-new unpublished merchant satisfied neither branch and every mobile
-- signup died with 42501. api/mobile-onboarding does
-- `.insert({...}).select('id, slug').single()` -- i.e. INSERT ... RETURNING.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_signup_insert_returning_rls.sql
--   or via Supabase MCP execute_sql
--
-- Asserts (RAISE EXCEPTION on any deviation):
--   1. The policy keeps a tuple-local owner branch (user_id = auth.uid()),
--      not only the self-lookup has_merchant_access(id).
--   2. An owner can INSERT ... RETURNING their own UNPUBLISHED merchant row
--      as the `authenticated` role.  <-- fails 42501 against the buggy policy
--   3. Containment holds: a different signed-in user still cannot read that
--      unpublished row (the fix must not widen the S1 read scope).
--
-- Everything runs inside a transaction that is rolled back; no fixture escapes.
-- =============================================

BEGIN;

-- --------------------------------------------------------------------------
-- Fixtures. merchants.user_id is FK -> auth.users(id), so both identities must
-- exist. Created before any SET ROLE (authenticated cannot write auth.users).
-- --------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-00000000c0de', 'rls-signup-owner@example.test'),
  ('00000000-0000-4000-a000-00000000beef', 'rls-signup-stranger@example.test');

-- --------------------------------------------------------------------------
-- 1. Policy shape: the owner branch must be a predicate over the row's own
--    columns. has_merchant_access(id) alone is unsatisfiable pre-insert.
-- --------------------------------------------------------------------------
DO $$
DECLARE
  policy_expr text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid)
    INTO policy_expr
    FROM pg_policy
   WHERE polrelid = 'public.merchants'::regclass
     AND polname  = 'Authenticated can view merchants';

  IF policy_expr IS NULL THEN
    RAISE EXCEPTION
      'merchants signup RLS: "Authenticated can view merchants" policy is missing';
  END IF;

  IF policy_expr NOT LIKE '%user_id%' THEN
    RAISE EXCEPTION
      'merchants signup RLS: policy lost its tuple-local owner branch '
      '(expected user_id = auth.uid()); INSERT ... RETURNING at signup will '
      '42501. Found: %', policy_expr;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 2. The regression itself: owner inserts their own unpublished merchant and
--    reads it back via RETURNING, as `authenticated`.
--    Role is switched at top level -- SET ROLE inside a DO block does not
--    reliably outlive the block.
-- --------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000c0de","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  returned_id   uuid;
  returned_slug text;
BEGIN
  BEGIN
    INSERT INTO public.merchants (
      id, user_id, email, business_name, business_type,
      country, payout_currency, slug, template_id, signup_source, is_published
    ) VALUES (
      '00000000-0000-4000-a000-0000000015ea',
      '00000000-0000-4000-a000-00000000c0de',
      'rls-signup-owner@example.test',
      'Rls Signup Regression Store',
      'retail',
      'NG', 'NGN',
      'rls-signup-regression-store',
      'puck', 'ios',
      false  -- the signup default; the published branch must NOT be what saves us
    )
    RETURNING id, slug INTO returned_id, returned_slug;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION
        'merchants signup RLS REGRESSION: owner INSERT ... RETURNING of their '
        'own unpublished merchant was rejected (42501). The authenticated '
        'SELECT policy is not satisfiable by a not-yet-visible row -- mobile '
        'signup is broken. SQLERRM: %', SQLERRM;
  END;

  IF returned_id IS NULL OR returned_slug IS NULL THEN
    RAISE EXCEPTION
      'merchants signup RLS: INSERT ... RETURNING produced no row for the owner';
  END IF;
END $$;

RESET ROLE;

-- --------------------------------------------------------------------------
-- 3. Non-widening: a different authenticated user must still not see the
--    unpublished row. Guards the S1 draft-store containment.
-- --------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000beef","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_rows int;
BEGIN
  SELECT count(*) INTO visible_rows
    FROM public.merchants
   WHERE id = '00000000-0000-4000-a000-0000000015ea';

  IF visible_rows <> 0 THEN
    RAISE EXCEPTION
      'merchants signup RLS: containment REGRESSION -- a non-owner signed-in '
      'user can read another merchant''s unpublished row (% rows visible)',
      visible_rows;
  END IF;

  RAISE NOTICE
    'merchant signup INSERT ... RETURNING RLS: all invariants hold '
    '(owner insert allowed, stranger read denied).';
END $$;

RESET ROLE;

ROLLBACK;
