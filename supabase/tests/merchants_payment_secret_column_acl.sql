-- Regression coverage for the S1 PR 2b payment-secret column revoke
-- (20260724090000_s1_pr2b_revoke_payment_secret_column_grants.sql).
-- Verifies at the column-ACL layer that `authenticated` and `anon` receive
-- 42501 when selecting paystack_subaccount_code / virtual_terminal_code from
-- public.merchants, while a permitted public column on a published merchant
-- remains readable. Run after the ordered S1 containment migrations.
BEGIN;

INSERT INTO public.merchants (id, email, business_name, slug, is_published)
VALUES (
  '00000000-0000-4000-8000-00000000f2b1'::uuid,
  's1-pr2b-acl@example.com',
  'S1 PR2b ACL Test',
  's1-pr2b-acl-test',
  true
);

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_dummy text;
  v_denied boolean;
BEGIN
  -- Revoked secret columns must fail with insufficient_privilege (42501).
  v_denied := false;
  BEGIN
    SELECT paystack_subaccount_code INTO v_dummy
    FROM public.merchants
    LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'authenticated can still SELECT paystack_subaccount_code';
  END IF;

  v_denied := false;
  BEGIN
    SELECT virtual_terminal_code INTO v_dummy
    FROM public.merchants
    LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'authenticated can still SELECT virtual_terminal_code';
  END IF;

  -- A granted public column on a published merchant stays readable — proves
  -- the revoke is column-scoped, not a table-wide break.
  SELECT business_name INTO v_dummy
  FROM public.merchants
  WHERE slug = 's1-pr2b-acl-test' AND is_published IS TRUE;
  IF v_dummy IS DISTINCT FROM 'S1 PR2b ACL Test' THEN
    RAISE EXCEPTION 'authenticated lost read access to public merchant columns';
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_dummy text;
  v_denied boolean;
BEGIN
  v_denied := false;
  BEGIN
    SELECT paystack_subaccount_code INTO v_dummy
    FROM public.merchants
    LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'anon can still SELECT paystack_subaccount_code';
  END IF;

  v_denied := false;
  BEGIN
    SELECT virtual_terminal_code INTO v_dummy
    FROM public.merchants
    LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'anon can still SELECT virtual_terminal_code';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
