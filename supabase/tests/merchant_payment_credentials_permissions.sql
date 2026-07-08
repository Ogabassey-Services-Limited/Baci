-- =============================================
-- REGRESSION TEST: merchant payment credentials vault permission lockdown
--   Locks the invariants established by migration
--   20260708093415_merchant_payment_credentials.sql:
--
--     1. Neither `anon` nor `authenticated` can EXECUTE any of the six
--        service_role-only RPCs that read/write the BYOK credential vault
--        (set/get-meta/get-ciphertext/mark-invalid/touch-validated/delete).
--     2. Neither `anon` nor `authenticated` can SELECT
--        private.merchant_payment_credentials directly — both the `private`
--        schema's USAGE grant and the table's SELECT grant are revoked from
--        those roles, so ciphertext is only reachable through the RPCs.
--     3. public.byok_fee_accruals RLS: an authenticated user who is neither
--        the owning merchant's user_id nor an active staff member sees zero
--        rows, while the owning merchant sees its own row. INSERT as
--        `authenticated` fails (table grants SELECT only to that role).
--
-- USAGE:
--   This is a privilege/RLS regression test for a Supabase preview branch,
--   not a local-only script. Run it with the Supabase MCP `execute_sql` tool
--   (or `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f
--   supabase/tests/merchant_payment_credentials_permissions.sql`) against the
--   preview branch the migration was applied to, AFTER
--   20260708093415_merchant_payment_credentials.sql has been applied there.
--   It asserts privileges and RLS behavior against whatever is currently
--   live — it does not require local Postgres.
--
-- SAFETY:
--   Every assertion is either a pure privilege-introspection query (no
--   fixtures, no writes) or runs inside the single `BEGIN; ... ROLLBACK;`
--   transaction below, so the script is replay-safe and side-effect-free
--   even against a database with real data. Each check is its own DO block
--   with a distinct RAISE EXCEPTION message naming the exact function/role/
--   assertion that failed, so failures are identifiable by message text —
--   physical line numbers shift whenever this file is reformatted.
-- =============================================

BEGIN;

-- --------------------------------------------------------
-- 1. RPC EXECUTE lockdown: anon/authenticated must be denied on all six
--    vault RPCs; service_role must still be granted (positive control that
--    also catches a typo'd function signature below).
-- --------------------------------------------------------
DO $$
DECLARE
  v_fn text;
  v_signatures text[] := ARRAY[
    'public.set_merchant_payment_credential(uuid,text,text,text,text,smallint,text)',
    'public.get_merchant_payment_credential_meta(uuid,text)',
    'public.get_merchant_payment_credential_ciphertext(uuid,text,text,text)',
    'public.mark_merchant_payment_credential_invalid(uuid,text,text,text,text)',
    'public.delete_merchant_payment_credential(uuid,text)',
    'public.touch_merchant_payment_credential_validated(uuid,text)'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_signatures LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not have EXECUTE on %', v_fn;
    END IF;

    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must not have EXECUTE on %', v_fn;
    END IF;

    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role must have EXECUTE on % (positive control failed — check the signature)', v_fn;
    END IF;
  END LOOP;

  RAISE NOTICE 'OK: all six merchant payment credential RPCs are service_role-only';
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 2. private.merchant_payment_credentials must not be reachable by
--    anon/authenticated, at either the schema-USAGE or table-SELECT level.
-- --------------------------------------------------------
DO $$
BEGIN
  IF has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'anon must not have USAGE on schema private';
  END IF;

  IF has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated must not have USAGE on schema private';
  END IF;

  IF has_table_privilege('anon', 'private.merchant_payment_credentials', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not have SELECT on private.merchant_payment_credentials';
  END IF;

  IF has_table_privilege('authenticated', 'private.merchant_payment_credentials', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must not have SELECT on private.merchant_payment_credentials';
  END IF;

  RAISE NOTICE 'OK: private.merchant_payment_credentials is unreachable by anon/authenticated (schema USAGE and table SELECT both revoked)';
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 3. byok_fee_accruals RLS + grants (fixtures rolled back at end of file).
-- --------------------------------------------------------
DO $$
DECLARE
  v_merchant_id   uuid := '8f0ed783-0000-4000-8000-0000000010a1';
  v_owner_id      uuid := '8f0ed783-0000-4000-8000-0000000010a2';
  v_outsider_id   uuid := '8f0ed783-0000-4000-8000-0000000010a3';
  v_pending_staff uuid := '8f0ed783-0000-4000-8000-0000000010a4';
  n int;
BEGIN
  -- Seed as service_role (RLS-bypassing).
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    v_owner_id,
    'byok-fee-accrual-test@example.com',
    'BYOK Fee Accrual Test Store',
    'byok-fee-accrual-test-store'
  );

  -- Staff row exists for this merchant but is NOT active — must not grant read.
  INSERT INTO public.staff_members (merchant_id, user_id, email, status)
  VALUES (v_merchant_id, v_pending_staff, 'pending-staff@example.com', 'pending');

  INSERT INTO public.byok_fee_accruals (
    merchant_id, provider, currency, order_amount, fee_amount, waived
  ) VALUES (
    v_merchant_id, 'stripe', 'USD', 1000, 0, true
  );

  RESET ROLE;

  -- 3a. An authenticated user who is neither the owner nor any staff member
  --     must see zero rows.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_outsider_id::text, true);

  SELECT count(*) INTO n
  FROM public.byok_fee_accruals
  WHERE merchant_id = v_merchant_id;

  IF n <> 0 THEN
    RAISE EXCEPTION 'LEAK: unrelated authenticated user saw % byok_fee_accruals row(s)', n;
  END IF;
  RESET ROLE;

  -- 3b. A staff row that exists but is not `status = 'active'` must also
  --     see zero rows.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_pending_staff::text, true);

  SELECT count(*) INTO n
  FROM public.byok_fee_accruals
  WHERE merchant_id = v_merchant_id;

  IF n <> 0 THEN
    RAISE EXCEPTION 'LEAK: non-active (pending) staff member saw % byok_fee_accruals row(s)', n;
  END IF;
  RESET ROLE;

  -- 3c. Positive control: the owning merchant's user_id CAN read its own
  --     accrual row (proves the policy isn't just vacuously always-false).
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);

  SELECT count(*) INTO n
  FROM public.byok_fee_accruals
  WHERE merchant_id = v_merchant_id;

  IF n <> 1 THEN
    RAISE EXCEPTION 'owning merchant should read its own byok_fee_accruals row, saw % row(s)', n;
  END IF;

  -- 3d. Write attempt as `authenticated` — even as the owner — must fail:
  --     the table grants SELECT only to authenticated; writes are
  --     service_role only.
  BEGIN
    INSERT INTO public.byok_fee_accruals (merchant_id, provider, currency, order_amount)
    VALUES (v_merchant_id, 'stripe', 'USD', 500);

    RAISE EXCEPTION 'authenticated INSERT into byok_fee_accruals unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  RAISE NOTICE 'OK: byok_fee_accruals — outsider and non-active staff blocked, owner reads its own row, authenticated INSERT denied';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
