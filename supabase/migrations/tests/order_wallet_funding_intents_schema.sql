-- =============================================
-- REGRESSION TEST: Wallet-funded order auto-debit schema and RPC
--   Validates server-owned funding intents, child payment ledger, feature
--   flags, storefront settings output, grants, RLS, and finalizer idempotency.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/order_wallet_funding_intents_schema.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_missing_table text;
  v_missing_column text;
  v_missing_index text;
  v_missing_policy text;
  v_public_execute boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_authenticated_create_execute boolean;
  v_authenticated_expire_execute boolean;
  v_authenticated_ambiguous_review_execute boolean;
  v_authenticated_event_execute boolean;
  v_service_ambiguous_review_execute boolean;
  v_service_event_execute boolean;
BEGIN
  SELECT expected.table_name
  INTO v_missing_table
  FROM (
    VALUES
      ('order_wallet_funding_intents'),
      ('order_wallet_funding_intent_payments'),
      ('order_wallet_funding_events')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = expected.table_name
  )
  LIMIT 1;

  IF v_missing_table IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet order funding table: %', v_missing_table;
  END IF;

  SELECT expected.table_name || '.' || expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('order_wallet_funding_intents', 'merchant_id'),
      ('order_wallet_funding_intents', 'customer_id'),
      ('order_wallet_funding_intents', 'order_id'),
      ('order_wallet_funding_intents', 'wallet_payment_account_id'),
      ('order_wallet_funding_intents', 'expected_amount'),
      ('order_wallet_funding_intents', 'target_order_amount'),
      ('order_wallet_funding_intents', 'funded_amount'),
      ('order_wallet_funding_intents', 'debited_amount'),
      ('order_wallet_funding_intents', 'excess_amount'),
      ('order_wallet_funding_intents', 'idempotency_key'),
      ('order_wallet_funding_intents', 'last_gateway_reference'),
      ('order_wallet_funding_intents', 'last_transaction_id'),
      ('order_wallet_funding_intents', 'expires_at'),
      ('order_wallet_funding_intent_payments', 'intent_id'),
      ('order_wallet_funding_intent_payments', 'provider'),
      ('order_wallet_funding_intent_payments', 'gateway_reference'),
      ('order_wallet_funding_intent_payments', 'transaction_id'),
      ('order_wallet_funding_intent_payments', 'amount'),
      ('order_wallet_funding_intent_payments', 'gateway_fee'),
      ('order_wallet_funding_intent_payments', 'wallet_credit_transaction_id'),
      ('order_wallet_funding_intent_payments', 'wallet_debit_transaction_id'),
      ('order_wallet_funding_intent_payments', 'order_payment_transaction_id'),
      ('order_wallet_funding_events', 'event_type'),
      ('order_wallet_funding_events', 'intent_id'),
      ('order_wallet_funding_events', 'order_id'),
      ('order_wallet_funding_events', 'transaction_id'),
      ('order_wallet_funding_events', 'gateway_reference'),
      ('order_wallet_funding_events', 'metadata'),
      ('merchant_feature_settings', 'wallet_order_auto_debit_enabled')
  ) AS expected(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = expected.table_name
      AND column_name = expected.column_name
  )
  LIMIT 1;

  IF v_missing_column IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet order funding column: %', v_missing_column;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid
      AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relname = 'merchant_feature_settings'
      AND a.attname = 'wallet_order_auto_debit_enabled'
      AND NOT a.attisdropped
      AND (
        ad.oid IS NULL
        OR COALESCE((pg_get_expr(ad.adbin, ad.adrelid))::boolean, true)
          IS DISTINCT FROM false
      )
  ) THEN
    RAISE EXCEPTION 'wallet_order_auto_debit_enabled must default false';
  END IF;

  SELECT expected.index_name
  INTO v_missing_index
  FROM (
    VALUES
      ('order_wallet_funding_intents_order_active_unique_idx'),
      ('order_wallet_funding_intents_idempotency_key_unique_idx'),
      ('order_wallet_funding_intents_merchant_id_idx'),
      ('order_wallet_funding_intents_customer_id_idx'),
      ('order_wallet_funding_intents_order_id_idx'),
      ('order_wallet_funding_intents_wallet_payment_account_id_idx'),
      ('order_wallet_funding_intents_last_transaction_id_idx'),
      ('order_wallet_funding_intents_wallet_status_expires_idx'),
      ('order_wallet_funding_intents_merchant_customer_status_expires_idx'),
      ('order_wallet_funding_intent_payments_reference_unique_idx'),
      ('order_wallet_funding_intent_payments_transaction_unique_idx'),
      ('order_wallet_funding_intent_payments_intent_idx'),
      ('order_wallet_funding_events_intent_created_idx'),
      ('order_wallet_funding_events_type_created_idx')
  ) AS expected(index_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = expected.index_name
  )
  LIMIT 1;

  IF v_missing_index IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet order funding index: %', v_missing_index;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE n.nspname = 'public'
      AND tbl.relname = 'order_wallet_funding_intents'
      AND idx.relname = 'order_wallet_funding_intents_order_active_unique_idx'
      AND i.indisunique
      AND pg_get_expr(i.indpred, i.indrelid) =
        '(status <> ALL (ARRAY[''expired''::text, ''cancelled''::text, ''failed''::text]))'
  ) THEN
    RAISE EXCEPTION 'active/non-retryable intent partial unique index is missing or too broad';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('order_wallet_funding_intents'),
        ('order_wallet_funding_intent_payments'),
        ('order_wallet_funding_events')
    ) AS expected(table_name)
    JOIN pg_class c ON c.relname = expected.table_name
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relrowsecurity IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'wallet order funding tables must have RLS enabled';
  END IF;

  SELECT expected.policy_name
  INTO v_missing_policy
  FROM (
    VALUES
      ('order_wallet_funding_intents_customer_select'),
      ('order_wallet_funding_intent_payments_customer_select')
  ) AS expected(policy_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = expected.policy_name
      AND cmd = 'SELECT'
  )
  LIMIT 1;

  IF v_missing_policy IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet order funding customer SELECT policy: %', v_missing_policy;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.finalize_wallet_funded_order(uuid,text,uuid,numeric,numeric,timestamp with time zone,text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order must be SECURITY DEFINER with blank search_path';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = (
      'public.finalize_wallet_funded_order(uuid,text,uuid,numeric,numeric,timestamp with time zone,text)'
    )::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  )
  INTO v_public_execute;

  SELECT has_function_privilege(
    'anon',
    'public.finalize_wallet_funded_order(uuid,text,uuid,numeric,numeric,timestamp with time zone,text)',
    'EXECUTE'
  )
  INTO v_anon_execute;

  SELECT has_function_privilege(
    'authenticated',
    'public.finalize_wallet_funded_order(uuid,text,uuid,numeric,numeric,timestamp with time zone,text)',
    'EXECUTE'
  )
  INTO v_authenticated_execute;

  IF v_public_execute OR v_anon_execute OR v_authenticated_execute THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order must only be executable by service_role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.create_order_wallet_funding_intent_for_customer(uuid,uuid,uuid,uuid,timestamp with time zone)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'create_order_wallet_funding_intent_for_customer must be SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.expire_order_wallet_funding_intents(uuid,uuid,uuid,timestamp with time zone)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'expire_order_wallet_funding_intents must be SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.file_wallet_order_funding_ambiguous_review(text,uuid[],text)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'file_wallet_order_funding_ambiguous_review must be SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = (
      'public.record_wallet_order_funding_event(text,uuid,uuid,uuid,text,jsonb)'
    )::regprocedure
      AND prosecdef = true
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'record_wallet_order_funding_event must be SECURITY DEFINER with blank search_path';
  END IF;

  SELECT has_function_privilege(
    'authenticated',
    'public.create_order_wallet_funding_intent_for_customer(uuid,uuid,uuid,uuid,timestamp with time zone)',
    'EXECUTE'
  )
  INTO v_authenticated_create_execute;

  SELECT has_function_privilege(
    'authenticated',
    'public.expire_order_wallet_funding_intents(uuid,uuid,uuid,timestamp with time zone)',
    'EXECUTE'
  )
  INTO v_authenticated_expire_execute;

  SELECT has_function_privilege(
    'authenticated',
    'public.file_wallet_order_funding_ambiguous_review(text,uuid[],text)',
    'EXECUTE'
  )
  INTO v_authenticated_ambiguous_review_execute;

  SELECT has_function_privilege(
    'authenticated',
    'public.record_wallet_order_funding_event(text,uuid,uuid,uuid,text,jsonb)',
    'EXECUTE'
  )
  INTO v_authenticated_event_execute;

  SELECT has_function_privilege(
    'service_role',
    'public.file_wallet_order_funding_ambiguous_review(text,uuid[],text)',
    'EXECUTE'
  )
  INTO v_service_ambiguous_review_execute;

  SELECT has_function_privilege(
    'service_role',
    'public.record_wallet_order_funding_event(text,uuid,uuid,uuid,text,jsonb)',
    'EXECUTE'
  )
  INTO v_service_event_execute;

  IF NOT v_authenticated_create_execute OR NOT v_authenticated_expire_execute THEN
    RAISE EXCEPTION 'authenticated customers need scoped execute on wallet order intent creation/expiry RPCs';
  END IF;

  IF v_authenticated_ambiguous_review_execute OR NOT v_service_ambiguous_review_execute THEN
    RAISE EXCEPTION 'ambiguous review RPC must only be executable by service_role';
  END IF;

  IF v_authenticated_event_execute OR NOT v_service_event_execute THEN
    RAISE EXCEPTION 'wallet funding event RPC must only be executable by service_role';
  END IF;
END;
$$;

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000701';
  v_customer_id uuid := '8f0ed783-0000-4000-8000-000000000702';
  v_order_id uuid := '8f0ed783-0000-4000-8000-000000000703';
  v_wallet_payment_account_id uuid := '8f0ed783-0000-4000-8000-000000000704';
  v_paystack_transaction_id uuid := '8f0ed783-0000-4000-8000-000000000705';
  v_intent_id uuid := '8f0ed783-0000-4000-8000-000000000706';
  v_wallet_id uuid := '8f0ed783-0000-4000-8000-000000000707';
  v_paid_order_id uuid := '8f0ed783-0000-4000-8000-000000000708';
  v_paid_transaction_id uuid := '8f0ed783-0000-4000-8000-000000000709';
  v_paid_intent_id uuid := '8f0ed783-0000-4000-8000-00000000070a';
  v_mismatch_order_id uuid := '8f0ed783-0000-4000-8000-00000000070b';
  v_mismatch_transaction_id uuid := '8f0ed783-0000-4000-8000-00000000070c';
  v_mismatch_intent_id uuid := '8f0ed783-0000-4000-8000-00000000070d';
  v_result record;
  v_replay_result record;
  v_nonpayable_result record;
  v_mismatch_result record;
  v_mismatch_status text;
  v_wallet_balance numeric;
  v_wallet_credit_count integer;
  v_wallet_debit_count integer;
  v_order_payment_count integer;
  v_wallet_funding_event_count integer;
  v_funded_amount numeric;
  v_settings record;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'wallet-order-funding@example.com',
    'Wallet Order Funding Store',
    'wallet-order-funding-store'
  );

  INSERT INTO public.customers (id, merchant_id, email, first_name)
  VALUES (
    v_customer_id,
    v_merchant_id,
    'wallet-order-funding-customer@example.com',
    'Wallet'
  );

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    paystack_enabled,
    wallet_paystack_dva_enabled,
    wallet_order_auto_debit_enabled
  )
  VALUES (v_merchant_id, true, true, true)
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    paystack_enabled = EXCLUDED.paystack_enabled,
    wallet_paystack_dva_enabled = EXCLUDED.wallet_paystack_dva_enabled,
    wallet_order_auto_debit_enabled = EXCLUDED.wallet_order_auto_debit_enabled;

  SELECT *
  INTO v_settings
  FROM public.get_storefront_payment_settings(v_merchant_id);

  IF v_settings.wallet_paystack_dva_enabled IS DISTINCT FROM true
    OR v_settings.wallet_order_auto_debit_enabled IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'storefront settings did not expose wallet order flags: %', row_to_json(v_settings);
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

  INSERT INTO public.customer_wallet_payment_accounts (
    id,
    merchant_id,
    customer_id,
    provider,
    provider_customer_code,
    provider_subaccount_code,
    provider_account_id,
    account_number,
    account_name,
    bank_name,
    currency,
    status,
    consented_at
  )
  VALUES (
    v_wallet_payment_account_id,
    v_merchant_id,
    v_customer_id,
    'paystack',
    'CUS_wallet_order_funding',
    'ACCT_wallet_order_funding',
    'DVA_wallet_order_funding',
    '3348493944',
    'Wallet Order Funding Customer',
    'Paystack-Titan',
    'NGN',
    'active',
    now()
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    customer_id,
    order_number,
    customer_name,
    customer_email,
    payment_status,
    total,
    subtotal,
    currency,
    tracking_token
  )
  VALUES (
    v_order_id,
    v_merchant_id,
    v_customer_id,
    'WOF-ORDER-1',
    'Wallet Funding Customer',
    'wallet-order-funding-customer@example.com',
    'pending',
    20000,
    20000,
    'NGN',
    'wallet-order-funding-track'
  );

  INSERT INTO public.transactions (
    id,
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    gateway_response,
    merchant_amount,
    metadata
  )
  VALUES (
    v_paystack_transaction_id,
    v_merchant_id,
    NULL,
    'payment',
    20000,
    'NGN',
    'completed',
    'paystack',
    'WOF-PAYSTACK-REF-1',
    '{"fees":30000}'::jsonb,
    0,
    jsonb_build_object(
      'transaction_type', 'wallet_topup',
      'customer_id', v_customer_id,
      'wallet_payment_account_id', v_wallet_payment_account_id
    )
  );

  INSERT INTO public.order_wallet_funding_intents (
    id,
    merchant_id,
    customer_id,
    order_id,
    wallet_payment_account_id,
    expected_amount,
    target_order_amount,
    wallet_balance_snapshot,
    idempotency_key,
    expires_at
  )
  VALUES (
    v_intent_id,
    v_merchant_id,
    v_customer_id,
    v_order_id,
    v_wallet_payment_account_id,
    20000,
    20000,
    0,
    'order-wallet-funding:test:1',
    now() + interval '30 minutes'
  );

  SELECT *
  INTO v_result
  FROM public.finalize_wallet_funded_order(
    v_intent_id,
    'WOF-PAYSTACK-REF-1',
    v_paystack_transaction_id,
    20000,
    300,
    now(),
    'NGN'
  );

  IF v_result.order_paid IS DISTINCT FROM true
    OR v_result.credited_amount IS DISTINCT FROM 20000::numeric
    OR v_result.debited_amount IS DISTINCT FROM 20000::numeric
    OR v_result.excess_amount IS DISTINCT FROM 0::numeric
  THEN
    RAISE EXCEPTION 'finalizer did not return expected paid result: %', row_to_json(v_result);
  END IF;

  SELECT *
  INTO v_replay_result
  FROM public.finalize_wallet_funded_order(
    v_intent_id,
    'WOF-PAYSTACK-REF-1',
    v_paystack_transaction_id,
    20000,
    300,
    now(),
    'NGN'
  );

  IF v_replay_result.order_paid IS DISTINCT FROM true
    OR v_replay_result.wallet_credit_transaction_id IS DISTINCT FROM v_result.wallet_credit_transaction_id
    OR v_replay_result.wallet_debit_transaction_id IS DISTINCT FROM v_result.wallet_debit_transaction_id
    OR v_replay_result.order_payment_transaction_id IS DISTINCT FROM v_result.order_payment_transaction_id
  THEN
    RAISE EXCEPTION 'finalizer replay did not return the original idempotent result: %', row_to_json(v_replay_result);
  END IF;

  SELECT count(*)::integer
  INTO v_wallet_funding_event_count
  FROM public.order_wallet_funding_events
  WHERE intent_id = v_intent_id
    AND event_type IN (
      'wallet_funding_order_payment_created',
      'wallet_funding_idempotent_hit'
    );

  IF v_wallet_funding_event_count <> 2 THEN
    RAISE EXCEPTION 'expected completed and idempotent wallet funding events, got %', v_wallet_funding_event_count;
  END IF;

  SELECT available_balance
  INTO v_wallet_balance
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 0::numeric THEN
    RAISE EXCEPTION 'wallet balance should be zero after exact credit/debit, got %', v_wallet_balance;
  END IF;

  SELECT count(*)::integer
  INTO v_wallet_credit_count
  FROM public.customer_wallet_transactions
  WHERE customer_id = v_customer_id
    AND merchant_id = v_merchant_id
    AND source_type = 'wallet_topup'
    AND source_id = v_paystack_transaction_id
    AND type = 'credit';

  SELECT count(*)::integer
  INTO v_wallet_debit_count
  FROM public.customer_wallet_transactions
  WHERE customer_id = v_customer_id
    AND merchant_id = v_merchant_id
    AND source_type = 'order_redemption'
    AND source_id = v_order_id
    AND type = 'redemption';

  SELECT count(*)::integer
  INTO v_order_payment_count
  FROM public.transactions
  WHERE order_id = v_order_id
    AND gateway = 'wallet'
    AND gateway_reference = 'WALLET-DVA-ORDER-' || v_order_id::text
    AND status = 'completed';

  IF v_wallet_credit_count <> 1
    OR v_wallet_debit_count <> 1
    OR v_order_payment_count <> 1
  THEN
    RAISE EXCEPTION
      'idempotency count mismatch credit %, debit %, payment %',
      v_wallet_credit_count,
      v_wallet_debit_count,
      v_order_payment_count;
  END IF;

  SELECT funded_amount
  INTO v_funded_amount
  FROM public.order_wallet_funding_intents
  WHERE id = v_intent_id;

  IF v_funded_amount IS DISTINCT FROM 20000::numeric THEN
    RAISE EXCEPTION 'funded amount should not double-count replay, got %', v_funded_amount;
  END IF;

  INSERT INTO public.orders (
    id,
    merchant_id,
    customer_id,
    order_number,
    customer_name,
    customer_email,
    payment_status,
    total,
    subtotal,
    currency,
    tracking_token
  )
  VALUES (
    v_paid_order_id,
    v_merchant_id,
    v_customer_id,
    'WOF-ORDER-PAID',
    'Wallet Funding Customer',
    'wallet-order-funding-customer@example.com',
    'paid',
    5000,
    5000,
    'NGN',
    'wallet-order-funding-paid-track'
  );

  INSERT INTO public.transactions (
    id,
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    gateway_response,
    merchant_amount,
    metadata
  )
  VALUES (
    v_paid_transaction_id,
    v_merchant_id,
    NULL,
    'payment',
    5000,
    'NGN',
    'completed',
    'paystack',
    'WOF-PAYSTACK-REF-PAID',
    '{"fees":7500}'::jsonb,
    0,
    jsonb_build_object(
      'transaction_type', 'wallet_topup',
      'customer_id', v_customer_id,
      'wallet_payment_account_id', v_wallet_payment_account_id
    )
  );

  INSERT INTO public.order_wallet_funding_intents (
    id,
    merchant_id,
    customer_id,
    order_id,
    wallet_payment_account_id,
    expected_amount,
    target_order_amount,
    wallet_balance_snapshot,
    idempotency_key,
    expires_at
  )
  VALUES (
    v_paid_intent_id,
    v_merchant_id,
    v_customer_id,
    v_paid_order_id,
    v_wallet_payment_account_id,
    5000,
    5000,
    0,
    'order-wallet-funding:test:paid-order',
    now() + interval '30 minutes'
  );

  SELECT *
  INTO v_nonpayable_result
  FROM public.finalize_wallet_funded_order(
    v_paid_intent_id,
    'WOF-PAYSTACK-REF-PAID',
    v_paid_transaction_id,
    5000,
    75,
    now(),
    'NGN'
  );

  IF v_nonpayable_result.order_paid IS DISTINCT FROM false
    OR v_nonpayable_result.credited_amount IS DISTINCT FROM 5000::numeric
    OR v_nonpayable_result.debited_amount IS DISTINCT FROM 0::numeric
    OR v_nonpayable_result.wallet_credit_transaction_id IS NULL
    OR v_nonpayable_result.wallet_debit_transaction_id IS NOT NULL
    OR v_nonpayable_result.order_payment_transaction_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'non-payable order funding should credit wallet only: %', row_to_json(v_nonpayable_result);
  END IF;

  SELECT count(*)::integer
  INTO v_wallet_funding_event_count
  FROM public.order_wallet_funding_events
  WHERE intent_id = v_paid_intent_id
    AND event_type = 'wallet_funding_review_created'
    AND metadata->>'reason' = 'order_not_payable';

  IF v_wallet_funding_event_count <> 1 THEN
    RAISE EXCEPTION 'non-payable order transfer should record one review event, got %', v_wallet_funding_event_count;
  END IF;

  SELECT available_balance
  INTO v_wallet_balance
  FROM public.customer_wallets
  WHERE id = v_wallet_id;

  IF v_wallet_balance IS DISTINCT FROM 5000::numeric THEN
    RAISE EXCEPTION 'non-payable order transfer should remain in wallet, got balance %', v_wallet_balance;
  END IF;

  SELECT count(*)::integer
  INTO v_wallet_debit_count
  FROM public.customer_wallet_transactions
  WHERE customer_id = v_customer_id
    AND merchant_id = v_merchant_id
    AND source_type = 'order_redemption'
    AND source_id = v_paid_order_id
    AND type = 'redemption';

  IF v_wallet_debit_count <> 0 THEN
    RAISE EXCEPTION 'non-payable order transfer must not create a wallet debit';
  END IF;

  INSERT INTO public.orders (
    id,
    merchant_id,
    customer_id,
    order_number,
    customer_name,
    customer_email,
    payment_status,
    total,
    subtotal,
    currency,
    tracking_token
  )
  VALUES (
    v_mismatch_order_id,
    v_merchant_id,
    v_customer_id,
    'WOF-ORDER-MISMATCH',
    'Wallet Funding Customer',
    'wallet-order-funding-customer@example.com',
    'pending',
    1000,
    1000,
    'NGN',
    'wallet-order-funding-mismatch-track'
  );

  INSERT INTO public.transactions (
    id,
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    gateway_response,
    merchant_amount,
    metadata
  )
  VALUES (
    v_mismatch_transaction_id,
    v_merchant_id,
    NULL,
    'payment',
    1000.01,
    'NGN',
    'completed',
    'paystack',
    'WOF-PAYSTACK-REF-MISMATCH',
    '{"fees":1500}'::jsonb,
    0,
    jsonb_build_object(
      'transaction_type', 'wallet_topup',
      'customer_id', v_customer_id,
      'wallet_payment_account_id', v_wallet_payment_account_id
    )
  );

  INSERT INTO public.order_wallet_funding_intents (
    id,
    merchant_id,
    customer_id,
    order_id,
    wallet_payment_account_id,
    expected_amount,
    target_order_amount,
    wallet_balance_snapshot,
    idempotency_key,
    expires_at
  )
  VALUES (
    v_mismatch_intent_id,
    v_merchant_id,
    v_customer_id,
    v_mismatch_order_id,
    v_wallet_payment_account_id,
    1000,
    1000,
    0,
    'order-wallet-funding:test:mismatch',
    now() + interval '30 minutes'
  );

  SELECT *
  INTO v_mismatch_result
  FROM public.finalize_wallet_funded_order(
    v_mismatch_intent_id,
    'WOF-PAYSTACK-REF-MISMATCH',
    v_mismatch_transaction_id,
    1000,
    15,
    now(),
    'NGN'
  );

  IF v_mismatch_result.order_paid IS DISTINCT FROM false
    OR v_mismatch_result.credited_amount IS DISTINCT FROM 0::numeric
    OR v_mismatch_result.wallet_credit_transaction_id IS NOT NULL
    OR v_mismatch_result.wallet_debit_transaction_id IS NOT NULL
    OR v_mismatch_result.order_payment_transaction_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'one-kobo mismatched funding should not credit or debit wallet: %', row_to_json(v_mismatch_result);
  END IF;

  SELECT status
  INTO v_mismatch_status
  FROM public.order_wallet_funding_intents
  WHERE id = v_mismatch_intent_id;

  IF v_mismatch_status IS DISTINCT FROM 'review_required' THEN
    RAISE EXCEPTION 'one-kobo mismatched funding should require review, got %', v_mismatch_status;
  END IF;

  SELECT count(*)::integer
  INTO v_wallet_funding_event_count
  FROM public.order_wallet_funding_events
  WHERE intent_id = v_mismatch_intent_id
    AND event_type = 'wallet_funding_review_created'
    AND metadata->>'reason' = 'funding_transaction_validation_failed'
    AND metadata->>'amount_difference_kobo' = '1';

  IF v_wallet_funding_event_count <> 1 THEN
    RAISE EXCEPTION 'one-kobo mismatched funding should record one review event, got %', v_wallet_funding_event_count;
  END IF;
END;
$$;

ROLLBACK;
