-- =============================================
-- REGRESSION TEST: Customer device savings RPCs
--   Validates manual goal creation, wallet allocation idempotency,
--   insufficient balance rejection, completed-goal transition, and grants.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/customer_device_savings_rpcs.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000501';
  v_customer_id uuid := '8f0ed783-0000-4000-8000-000000000502';
  v_product_id uuid := '8f0ed783-0000-4000-8000-000000000503';
  v_wallet_id uuid := '8f0ed783-0000-4000-8000-000000000504';
  v_goal_id uuid;
  v_completed_goal_id uuid;
  v_create_result record;
  v_duplicate_result record;
  v_completed_result record;
  v_contribution_count integer;
  v_wallet_balance numeric;
  v_total_redeemed numeric;
  v_goal_current_amount numeric;
  v_goal_status text;
  v_anon_execute boolean;
  v_duplicate_rejected boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.create_customer_savings_goal(uuid,uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,text,time,date,date,text,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,numeric,jsonb,text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'create_customer_savings_goal must be SECURITY DEFINER with blank search_path';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = (
      'public.allocate_customer_savings_contribution(uuid,uuid,uuid,numeric,text,uuid,text,text)'
    )::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution must not be executable by PUBLIC';
  END IF;

  SELECT has_function_privilege(
    'anon',
    'public.allocate_customer_savings_contribution(uuid,uuid,uuid,numeric,text,uuid,text,text)',
    'EXECUTE'
  )
  INTO v_anon_execute;

  IF v_anon_execute THEN
    RAISE EXCEPTION 'allocate_customer_savings_contribution must not be executable by anon';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant_id, 'savings-rpc@example.com', 'Savings RPC Store', 'savings-rpc-store');

  INSERT INTO public.customers (id, merchant_id, email, first_name)
  VALUES (v_customer_id, v_merchant_id, 'savings-customer@example.com', 'Savings');

  INSERT INTO public.products (id, merchant_id, name, price, status, stock_quantity)
  VALUES (v_product_id, v_merchant_id, 'iPhone savings test', 800000, 'active', 3);

  INSERT INTO public.customer_wallets (
    id,
    customer_id,
    merchant_id,
    available_balance,
    total_earned,
    total_redeemed
  )
  VALUES (v_wallet_id, v_customer_id, v_merchant_id, 100000, 100000, 0);

  SELECT *
  INTO v_create_result
  FROM public.create_customer_savings_goal(
    v_customer_id,
    v_merchant_id,
    v_product_id,
    NULL,
    'iPhone savings test',
    '{"name":"iPhone savings test","price":800000}'::jsonb,
    800000,
    20000,
    20000,
    'daily',
    '06:20'::time,
    current_date,
    current_date + 30,
    'manual',
    NULL,
    now(),
    now(),
    NULL,
    NULL,
    0,
    '{"test":"manual-initial"}'::jsonb,
    'savings-rpc:create-initial'
  );

  IF v_create_result.success IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'manual create did not return success: %', row_to_json(v_create_result);
  END IF;

  v_goal_id := v_create_result.goal_id;

  SELECT available_balance, total_redeemed
  INTO v_wallet_balance, v_total_redeemed
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 80000::numeric THEN
    RAISE EXCEPTION 'manual initial contribution did not debit wallet to 80000, got %', v_wallet_balance;
  END IF;

  IF v_total_redeemed IS DISTINCT FROM 0::numeric THEN
    RAISE EXCEPTION 'device savings reservation must not increase total_redeemed, got %', v_total_redeemed;
  END IF;

  SELECT current_amount, status
  INTO v_goal_current_amount, v_goal_status
  FROM public.customer_savings_goals
  WHERE id = v_goal_id;

  IF v_goal_current_amount IS DISTINCT FROM 20000::numeric
    OR v_goal_status IS DISTINCT FROM 'active'
  THEN
    RAISE EXCEPTION 'goal state after initial contribution was unexpected: %, %',
      v_goal_current_amount,
      v_goal_status;
  END IF;

  SELECT count(*)::integer
  INTO v_contribution_count
  FROM public.customer_savings_contributions
  WHERE goal_id = v_goal_id
    AND idempotency_key = 'savings-rpc:create-initial'
    AND status = 'completed';

  IF v_contribution_count <> 1 THEN
    RAISE EXCEPTION 'expected one completed initial contribution, got %', v_contribution_count;
  END IF;

  SELECT *
  INTO v_duplicate_result
  FROM public.allocate_customer_savings_contribution(
    v_goal_id,
    v_customer_id,
    v_merchant_id,
    20000,
    'wallet',
    NULL,
    'savings-rpc:create-initial',
    'Duplicate initial contribution'
  );

  IF v_duplicate_result.contribution_id IS DISTINCT FROM v_create_result.contribution_id THEN
    RAISE EXCEPTION 'duplicate idempotency key returned a different contribution';
  END IF;

  SELECT available_balance INTO v_wallet_balance
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 80000::numeric THEN
    RAISE EXCEPTION 'duplicate contribution mutated wallet balance to %', v_wallet_balance;
  END IF;

  BEGIN
    PERFORM *
    FROM public.allocate_customer_savings_contribution(
      v_goal_id,
      v_customer_id,
      v_merchant_id,
      25000,
      'wallet',
      NULL,
      'savings-rpc:create-initial',
      'Mismatched duplicate initial contribution'
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_duplicate_rejected := true;
  END;

  IF v_duplicate_rejected IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'mismatched completed idempotency replay unexpectedly succeeded';
  END IF;

  SELECT available_balance INTO v_wallet_balance
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 80000::numeric THEN
    RAISE EXCEPTION 'mismatched duplicate mutated wallet balance to %', v_wallet_balance;
  END IF;

  BEGIN
    PERFORM *
    FROM public.allocate_customer_savings_contribution(
      v_goal_id,
      v_customer_id,
      v_merchant_id,
      1000000,
      'wallet',
      NULL,
      'savings-rpc:too-large',
      'Too large'
    );

    RAISE EXCEPTION 'insufficient wallet balance unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  SELECT *
  INTO v_completed_result
  FROM public.create_customer_savings_goal(
    v_customer_id,
    v_merchant_id,
    v_product_id,
    NULL,
    'Completed iPhone savings test',
    '{"name":"iPhone savings test","price":20000}'::jsonb,
    20000,
    20000,
    20000,
    'daily',
    '06:20'::time,
    current_date,
    current_date + 1,
    'manual',
    NULL,
    now(),
    now(),
    NULL,
    NULL,
    0,
    '{"test":"completed-initial"}'::jsonb,
    'savings-rpc:completed-initial'
  );

  v_completed_goal_id := v_completed_result.goal_id;

  SELECT status INTO v_goal_status
  FROM public.customer_savings_goals
  WHERE id = v_completed_goal_id;

  IF v_goal_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'goal reaching target should become completed, got %', v_goal_status;
  END IF;
END;
$$;

ROLLBACK;
