-- =============================================
-- REGRESSION TEST: Savings authorization customer RPCs
--   Validates scoped feature settings, backend-owned pending transactions,
--   and reference-specific confirmation after wallet credit accounting.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/customer_savings_authorization_confirmation_rpcs.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000601';
  v_customer_id uuid := '8f0ed783-0000-4000-8000-000000000602';
  v_wallet_id uuid := '8f0ed783-0000-4000-8000-000000000603';
  v_method_id uuid := '8f0ed783-0000-4000-8000-000000000604';
  v_old_method_id uuid := '8f0ed783-0000-4000-8000-000000000605';
  v_transaction_id uuid;
  v_failed_transaction_id uuid;
  v_failed_marked boolean;
  v_transaction_status text;
  v_status text;
  v_confirmed_method_id uuid;
  v_settings record;
  v_anon_execute boolean;
  v_wallet_dva_enabled boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.create_customer_savings_authorization_transaction(uuid,uuid,numeric,text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'create_customer_savings_authorization_transaction must be SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.confirm_customer_savings_authorization(uuid,uuid,text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'confirm_customer_savings_authorization must be SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.fail_customer_savings_authorization_transaction(uuid,uuid,text,text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'fail_customer_savings_authorization_transaction must be SECURITY DEFINER with blank search_path';
  END IF;

  SELECT has_function_privilege(
    'anon',
    'public.get_customer_savings_feature_settings(uuid,uuid)',
    'EXECUTE'
  )
  INTO v_anon_execute;

  IF v_anon_execute THEN
    RAISE EXCEPTION 'get_customer_savings_feature_settings must not be executable by anon';
  END IF;

  SELECT has_function_privilege(
    'anon',
    'public.get_customer_wallet_dva_enabled(uuid,uuid)',
    'EXECUTE'
  )
  INTO v_anon_execute;

  IF v_anon_execute THEN
    RAISE EXCEPTION 'get_customer_wallet_dva_enabled must not be executable by anon';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'savings-auth-rpc@example.com',
    'Savings Authorization RPC Store',
    'savings-auth-rpc-store'
  );

  INSERT INTO public.customers (id, merchant_id, email, first_name)
  VALUES (
    v_customer_id,
    v_merchant_id,
    'savings-authorization-customer@example.com',
    'Savings'
  );

  UPDATE public.merchant_feature_settings
  SET
    customer_device_savings_enabled = true,
    customer_device_savings_auto_debit_enabled = true,
    paystack_enabled = true,
    wallet_paystack_dva_enabled = true
  WHERE merchant_id = v_merchant_id;

  SELECT *
  INTO v_settings
  FROM public.get_customer_savings_feature_settings(v_customer_id, v_merchant_id);

  IF v_settings.customer_device_savings_enabled IS DISTINCT FROM true
    OR v_settings.customer_device_savings_auto_debit_enabled IS DISTINCT FROM true
    OR v_settings.paystack_enabled IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'customer savings settings were not returned correctly';
  END IF;

  v_wallet_dva_enabled := public.get_customer_wallet_dva_enabled(
    v_customer_id,
    v_merchant_id
  );
  IF v_wallet_dva_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'customer wallet DVA feature setting was not returned correctly';
  END IF;

  v_failed_transaction_id := public.create_customer_savings_authorization_transaction(
    v_customer_id,
    v_merchant_id,
    100,
    'SAV-AUTH-RPC-FAILED'
  );
  v_failed_marked := public.fail_customer_savings_authorization_transaction(
    v_customer_id,
    v_merchant_id,
    'SAV-AUTH-RPC-FAILED',
    'Paystack unavailable'
  );
  SELECT status
  INTO v_transaction_status
  FROM public.transactions
  WHERE id = v_failed_transaction_id;
  IF v_failed_marked IS DISTINCT FROM true OR v_transaction_status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'failed Paystack initialization did not terminate its pending transaction';
  END IF;

  INSERT INTO public.customer_wallets (
    id,
    customer_id,
    merchant_id,
    available_balance,
    total_earned,
    total_redeemed
  )
  VALUES (v_wallet_id, v_customer_id, v_merchant_id, 0, 0, 0);

  INSERT INTO public.customer_saved_payment_methods (
    id,
    merchant_id,
    customer_id,
    provider,
    provider_customer_email,
    authorization_code,
    authorization_signature,
    authorization_data,
    reusable,
    is_default,
    is_active
  )
  VALUES (
    v_old_method_id,
    v_merchant_id,
    v_customer_id,
    'paystack',
    'savings-authorization-customer@example.com',
    'AUTH_OLD',
    'sig-old',
    '{}'::jsonb,
    true,
    true,
    true
  );

  v_transaction_id := public.create_customer_savings_authorization_transaction(
    v_customer_id,
    v_merchant_id,
    100,
    'SAV-AUTH-RPC601'
  );

  SELECT status, saved_payment_method_id
  INTO v_status, v_confirmed_method_id
  FROM public.confirm_customer_savings_authorization(
    v_customer_id,
    v_merchant_id,
    'SAV-AUTH-RPC601'
  );

  IF v_status IS DISTINCT FROM 'processing' OR v_confirmed_method_id IS NOT NULL THEN
    RAISE EXCEPTION 'an unrelated existing card incorrectly confirmed a new authorization';
  END IF;

  UPDATE public.transactions
  SET
    status = 'completed',
    gateway_response = '{"authorization":{"signature":"sig-new"}}'::jsonb
  WHERE id = v_transaction_id;

  INSERT INTO public.customer_saved_payment_methods (
    id,
    merchant_id,
    customer_id,
    provider,
    provider_customer_email,
    authorization_code,
    authorization_signature,
    authorization_data,
    reusable,
    is_default,
    is_active
  )
  VALUES (
    v_method_id,
    v_merchant_id,
    v_customer_id,
    'paystack',
    'savings-authorization-customer@example.com',
    'AUTH_NEW',
    'sig-new',
    '{}'::jsonb,
    true,
    false,
    true
  );

  SELECT status, saved_payment_method_id
  INTO v_status, v_confirmed_method_id
  FROM public.confirm_customer_savings_authorization(
    v_customer_id,
    v_merchant_id,
    'SAV-AUTH-RPC601'
  );

  IF v_status IS DISTINCT FROM 'processing' OR v_confirmed_method_id IS NOT NULL THEN
    RAISE EXCEPTION 'authorization must wait until its wallet credit is accounted';
  END IF;

  INSERT INTO public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    status,
    description
  )
  VALUES (
    v_wallet_id,
    v_customer_id,
    v_merchant_id,
    'credit',
    100,
    100,
    'wallet_topup',
    v_transaction_id,
    'completed',
    'Savings authorization accounting confirmation'
  );

  SELECT status, saved_payment_method_id
  INTO v_status, v_confirmed_method_id
  FROM public.confirm_customer_savings_authorization(
    v_customer_id,
    v_merchant_id,
    'SAV-AUTH-RPC601'
  );

  IF v_status IS DISTINCT FROM 'successful' OR v_confirmed_method_id IS DISTINCT FROM v_method_id THEN
    RAISE EXCEPTION 'authorization did not confirm its exact saved payment method';
  END IF;
END;
$$;

ROLLBACK;
