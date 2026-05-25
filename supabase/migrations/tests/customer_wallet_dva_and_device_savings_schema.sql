-- =============================================
-- REGRESSION TEST: Customer wallet DVA and device savings schema
--   Validates the schema foundation for Paystack wallet funding accounts,
--   non-withdrawable device savings, idempotency guards, and feature flags.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/customer_wallet_dva_and_device_savings_schema.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_missing_table text;
  v_missing_column text;
  v_missing_index text;
  v_missing_policy text;
  v_redemption_order_index_columns text[];
BEGIN
  SELECT expected.table_name
  INTO v_missing_table
  FROM (
    VALUES
      ('customer_wallet_payment_accounts'),
      ('customer_savings_goals'),
      ('customer_savings_contributions'),
      ('customer_savings_redemptions'),
      ('customer_savings_events')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = expected.table_name
  )
  LIMIT 1;

  IF v_missing_table IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet/savings table: %', v_missing_table;
  END IF;

  SELECT expected.table_name || '.' || expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('customer_wallet_payment_accounts', 'provider_subaccount_code'),
      ('customer_wallet_payment_accounts', 'consented_at'),
      ('customer_savings_goals', 'spent_at'),
      ('customer_savings_goals', 'applied_order_id'),
      ('customer_savings_contributions', 'idempotency_key'),
      ('customer_savings_redemptions', 'idempotency_key'),
      ('customer_savings_events', 'actor_type'),
      ('merchant_feature_settings', 'wallet_paystack_dva_enabled'),
      ('merchant_feature_settings', 'customer_device_savings_enabled'),
      ('merchant_feature_settings', 'customer_device_savings_auto_debit_enabled'),
      ('merchant_feature_settings', 'customer_device_savings_break_fee_enabled')
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
    RAISE EXCEPTION 'missing wallet/savings column: %', v_missing_column;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_wallet_payment_accounts'
      AND column_name = 'provider_subaccount_code'
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'provider_subaccount_code must be NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'customer_wallet_payment_accounts'
      AND indexname = 'idx_customer_wallet_payment_accounts_customer_provider'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%merchant_id%'
      AND indexdef ILIKE '%customer_id%'
      AND indexdef ILIKE '%provider%'
  ) THEN
    RAISE EXCEPTION 'customer/provider wallet DVA uniqueness index missing';
  END IF;

  SELECT expected.index_name
  INTO v_missing_index
  FROM (
    VALUES
      ('idx_customer_savings_goals_saved_payment_method'),
      ('idx_customer_savings_goals_applied_order'),
      ('idx_customer_savings_goals_variant'),
      ('idx_customer_savings_contributions_wallet_transaction'),
      ('idx_customer_savings_contributions_transaction'),
      ('idx_customer_savings_contributions_saved_payment_method'),
      ('idx_customer_savings_redemptions_goal'),
      ('idx_customer_savings_events_goal')
  ) AS expected(index_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = expected.index_name
  )
  LIMIT 1;

  IF v_missing_index IS NOT NULL THEN
    RAISE EXCEPTION 'missing wallet/savings FK index: %', v_missing_index;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'customer_wallet_payment_accounts'
      AND indexname = 'idx_customer_wallet_payment_accounts_merchant_customer'
  ) THEN
    RAISE EXCEPTION 'redundant customer wallet merchant/customer index should not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'customer_wallet_payment_accounts'
      AND indexname = 'idx_customer_wallet_payment_accounts_provider_account'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%provider%'
      AND indexdef ILIKE '%account_number%'
  ) THEN
    RAISE EXCEPTION 'provider/account wallet DVA uniqueness index missing';
  END IF;

  SELECT array_agg(a.attname ORDER BY k.ordinality)
  INTO v_redemption_order_index_columns
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
  WHERE i.relname = 'idx_customer_savings_redemptions_order';

  IF v_redemption_order_index_columns IS DISTINCT FROM ARRAY['order_id']::text[] THEN
    RAISE EXCEPTION
      'savings redemption order uniqueness must be only order_id, got %',
      v_redemption_order_index_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND indexname = 'transactions_wallet_savings_gateway_reference_unique_idx'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%wallet_topup%'
      AND indexdef ILIKE '%savings_authorization%'
      AND indexdef ILIKE '%savings_auto_debit%'
      AND indexdef ILIKE '%gateway_reference IS NOT NULL%'
  ) THEN
    RAISE EXCEPTION 'wallet/savings transaction gateway reference unique index missing or too broad';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('customer_wallet_payment_accounts'),
        ('customer_savings_goals'),
        ('customer_savings_contributions'),
        ('customer_savings_redemptions'),
        ('customer_savings_events')
    ) AS expected(table_name)
    JOIN pg_class c ON c.relname = expected.table_name
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relrowsecurity IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'all wallet/savings tables must have RLS enabled';
  END IF;

  SELECT expected.policy_name
  INTO v_missing_policy
  FROM (
    VALUES
      ('customer_wallet_payment_accounts_customer_select'),
      ('customer_savings_goals_customer_select'),
      ('customer_savings_contributions_customer_select'),
      ('customer_savings_redemptions_customer_select'),
      ('customer_savings_events_customer_select')
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
    RAISE EXCEPTION 'missing customer SELECT RLS policy: %', v_missing_policy;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.customer_wallet_payment_accounts'::regclass
      AND tgname = 'customer_wallet_payment_accounts_updated_at'
      AND tgfoid = 'public.update_updated_at_column()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'wallet payment accounts updated_at trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.customer_savings_goals'::regclass
      AND tgname = 'customer_savings_goals_updated_at'
      AND tgfoid = 'public.update_updated_at_column()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'savings goals updated_at trigger missing';
  END IF;
END;
$$;

ROLLBACK;
