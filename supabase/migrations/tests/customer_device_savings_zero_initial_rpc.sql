-- =============================================
-- REGRESSION TEST: zero-initial customer savings goal creation
--   Ensures create_customer_savings_goal does not read an unassigned RECORD
--   when no initial contribution allocation is created.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/customer_device_savings_zero_initial_rpc.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000701';
  v_customer_id uuid := '8f0ed783-0000-4000-8000-000000000702';
  v_product_id uuid := '8f0ed783-0000-4000-8000-000000000703';
  v_wallet_id uuid := '8f0ed783-0000-4000-8000-000000000704';
  v_goal_id uuid;
  v_result record;
  v_wallet_balance numeric;
  v_goal_current_amount numeric;
  v_goal_status text;
  v_contribution_count integer;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'savings-zero-initial-rpc@example.com',
    'Savings Zero Initial RPC Store',
    'savings-zero-initial-rpc-store'
  );

  INSERT INTO public.customers (id, merchant_id, email, first_name)
  VALUES (
    v_customer_id,
    v_merchant_id,
    'savings-zero-initial-customer@example.com',
    'Savings'
  );

  INSERT INTO public.products (id, merchant_id, name, price, status, stock_quantity)
  VALUES (v_product_id, v_merchant_id, 'Zero initial savings test', 800000, 'active', 3);

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
  INTO v_result
  FROM public.create_customer_savings_goal(
    v_customer_id,
    v_merchant_id,
    v_product_id,
    NULL,
    'Zero initial savings test',
    '{"name":"Zero initial savings test","price":800000}'::jsonb,
    800000,
    0,
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
    '{"test":"manual-zero-initial"}'::jsonb,
    'savings-rpc:create-zero-initial'
  );

  IF v_result.success IS DISTINCT FROM true
    OR v_result.current_amount IS DISTINCT FROM 0::numeric
    OR v_result.contribution_id IS NOT NULL
    OR v_result.goal_status IS DISTINCT FROM 'active'
  THEN
    RAISE EXCEPTION 'manual zero-initial create returned unexpected result: %',
      row_to_json(v_result);
  END IF;

  v_goal_id := v_result.goal_id;

  SELECT available_balance
  INTO v_wallet_balance
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 100000::numeric THEN
    RAISE EXCEPTION 'zero initial contribution mutated wallet balance to %',
      v_wallet_balance;
  END IF;

  SELECT current_amount, status
  INTO v_goal_current_amount, v_goal_status
  FROM public.customer_savings_goals
  WHERE id = v_goal_id;

  IF v_goal_current_amount IS DISTINCT FROM 0::numeric
    OR v_goal_status IS DISTINCT FROM 'active'
  THEN
    RAISE EXCEPTION 'zero-initial goal state was unexpected: %, %',
      v_goal_current_amount,
      v_goal_status;
  END IF;

  SELECT count(*)::integer
  INTO v_contribution_count
  FROM public.customer_savings_contributions
  WHERE goal_id = v_goal_id;

  IF v_contribution_count <> 0 THEN
    RAISE EXCEPTION 'zero initial contribution created % contribution rows',
      v_contribution_count;
  END IF;
END;
$$;

ROLLBACK;
