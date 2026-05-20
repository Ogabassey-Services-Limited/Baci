-- =============================================
-- REGRESSION TEST: Klump payment foundation
--   Validates merchant feature columns, storefront RPC output, settlement
--   gateway check, Klump reference uniqueness, and record RPC behavior.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/klump_payment_foundation.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000301';
  v_other_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000302';
  v_order_id uuid := '8f0ed783-0000-4000-8000-000000000303';
  v_other_order_id uuid := '8f0ed783-0000-4000-8000-000000000304';
  v_transaction_id uuid := '8f0ed783-0000-4000-8000-000000000305';
  v_mismatched_transaction_id uuid := '8f0ed783-0000-4000-8000-000000000306';
  v_settings record;
  v_result record;
  v_klump_transaction_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchant_feature_settings'
      AND column_name IN ('klump_enabled', 'klump_min_amount', 'klump_max_amount')
    GROUP BY table_schema, table_name
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'merchant_feature_settings is missing Klump columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.merchant_feature_settings'::regclass
      AND conname = 'merchant_feature_settings_klump_min_amount_nonnegative'
  ) THEN
    RAISE EXCEPTION 'Klump min amount constraint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.merchant_feature_settings'::regclass
      AND conname = 'merchant_feature_settings_klump_max_amount_not_below_min'
  ) THEN
    RAISE EXCEPTION 'Klump max >= min constraint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND indexname = 'transactions_klump_gateway_reference_unique_idx'
      AND indexdef ILIKE '%gateway = ''klump''%'
  ) THEN
    RAISE EXCEPTION 'Klump gateway reference partial unique index missing or too broad';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.record_klump_transaction_id(text,text,text)'::regprocedure
      AND prosecdef = true
      AND proconfig @> ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'record_klump_transaction_id must be SECURITY DEFINER with search_path=public';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = 'public.record_klump_transaction_id(text,text,text)'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'record_klump_transaction_id must not grant EXECUTE to PUBLIC';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    'public.record_klump_transaction_id(text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'record_klump_transaction_id must grant EXECUTE to anon for guest checkout callbacks';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.record_klump_transaction_id(text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'record_klump_transaction_id must grant EXECUTE to authenticated';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES
    (v_merchant_id, 'klump-foundation@example.com', 'Klump Foundation Store', 'klump-foundation-store'),
    (v_other_merchant_id, 'klump-other@example.com', 'Klump Other Store', 'klump-other-store');

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    klump_enabled,
    klump_min_amount,
    klump_max_amount
  ) VALUES (
    v_merchant_id,
    true,
    2500,
    750000
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    klump_enabled = EXCLUDED.klump_enabled,
    klump_min_amount = EXCLUDED.klump_min_amount,
    klump_max_amount = EXCLUDED.klump_max_amount;

  SELECT *
  INTO v_settings
  FROM public.get_storefront_payment_settings(v_merchant_id);

  IF v_settings.klump_enabled IS DISTINCT FROM true
    OR v_settings.klump_min_amount IS DISTINCT FROM 2500
    OR v_settings.klump_max_amount IS DISTINCT FROM 750000
  THEN
    RAISE EXCEPTION 'storefront payment settings did not expose Klump settings: %', row_to_json(v_settings);
  END IF;

  BEGIN
    UPDATE public.merchant_feature_settings
    SET klump_min_amount = -1
    WHERE merchant_id = v_merchant_id;

    RAISE EXCEPTION 'negative Klump min amount unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.merchant_feature_settings
    SET klump_max_amount = 1000,
        klump_min_amount = 2000
    WHERE merchant_id = v_merchant_id;

    RAISE EXCEPTION 'Klump max below min unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.merchant_settlements (
    merchant_id,
    source_type,
    gateway,
    gateway_reference,
    gross_amount,
    net_amount,
    expected_settlement_date
  ) VALUES (
    v_merchant_id,
    'order',
    'klump',
    'BAC-KLUMP-SETTLEMENT',
    50000,
    49000,
    current_date
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    customer_email,
    payment_status,
    total,
    tracking_token
  ) VALUES
    (
      v_order_id,
      v_merchant_id,
      'KLUMP-ORDER-1',
      'Klump Customer',
      'customer@example.com',
      'pending',
      50000,
      'klump-track-token'
    ),
    (
      v_other_order_id,
      v_other_merchant_id,
      'KLUMP-ORDER-2',
      'Other Customer',
      'other-customer@example.com',
      'pending',
      50000,
      'other-track-token'
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
    metadata
  ) VALUES (
    v_transaction_id,
    v_merchant_id,
    v_order_id,
    'payment',
    50000,
    'NGN',
    'pending',
    'klump',
    'BAC-KLUMP-FOUNDATION',
    '{}'::jsonb
  );

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-FOUNDATION',
    'klump-txn-1',
    'klump-track-token'
  );

  IF v_result.code <> 'OK' OR v_result.transaction_id <> v_transaction_id THEN
    RAISE EXCEPTION 'first Klump record returned unexpected result: %', row_to_json(v_result);
  END IF;

  SELECT metadata->>'klump_transaction_id'
  INTO v_klump_transaction_id
  FROM public.transactions
  WHERE id = v_transaction_id;

  IF v_klump_transaction_id <> 'klump-txn-1' THEN
    RAISE EXCEPTION 'Klump transaction id was not stored in metadata';
  END IF;

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-FOUNDATION',
    'klump-txn-1',
    'klump-track-token'
  );

  IF v_result.code <> 'OK' THEN
    RAISE EXCEPTION 'idempotent Klump record returned unexpected result: %', row_to_json(v_result);
  END IF;

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-FOUNDATION',
    'klump-txn-2',
    'klump-track-token'
  );

  IF v_result.code <> 'KLUMP_ID_CONFLICT' THEN
    RAISE EXCEPTION 'conflicting Klump id returned unexpected result: %', row_to_json(v_result);
  END IF;

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-FOUNDATION',
    'klump-txn-1',
    'wrong-track-token'
  );

  IF v_result.code <> 'UNAUTHORIZED' THEN
    RAISE EXCEPTION 'wrong tracking token returned unexpected result: %', row_to_json(v_result);
  END IF;

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-UNKNOWN',
    'klump-txn-unknown',
    'klump-track-token'
  );

  IF v_result.code <> 'NOT_FOUND' THEN
    RAISE EXCEPTION 'unknown Klump reference returned unexpected result: %', row_to_json(v_result);
  END IF;

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
    metadata
  ) VALUES (
    v_mismatched_transaction_id,
    v_merchant_id,
    v_other_order_id,
    'payment',
    50000,
    'NGN',
    'pending',
    'klump',
    'BAC-KLUMP-MISMATCH',
    '{}'::jsonb
  );

  SELECT *
  INTO v_result
  FROM public.record_klump_transaction_id(
    'BAC-KLUMP-MISMATCH',
    'klump-txn-mismatch',
    'other-track-token'
  );

  IF v_result.code <> 'UNAUTHORIZED' THEN
    RAISE EXCEPTION 'cross-merchant order join returned unexpected result: %', row_to_json(v_result);
  END IF;

  BEGIN
    INSERT INTO public.transactions (
      merchant_id,
      order_id,
      transaction_type,
      amount,
      currency,
      status,
      gateway,
      gateway_reference,
      metadata
    ) VALUES (
      v_merchant_id,
      v_order_id,
      'payment',
      50000,
      'NGN',
      'pending',
      'klump',
      'BAC-KLUMP-FOUNDATION',
      '{}'::jsonb
    );

    RAISE EXCEPTION 'duplicate Klump gateway reference unexpectedly succeeded';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  RAISE NOTICE 'OK: Klump payment foundation passed';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
