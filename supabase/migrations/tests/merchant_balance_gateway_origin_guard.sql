-- =============================================
-- REGRESSION TEST: merchant_balances gateway-origin guard
--   Validates 20260724140000_merchant_balance_gateway_origin_guard.sql.
--
-- BUG: update_merchant_balance() credited merchant_balances for EVERY completed
-- 'payment' regardless of gateway, so Paystack (direct-settle) orders created a
-- phantom withdrawable balance for money Baci never held.
--
-- USAGE (run against a DB that has the migration applied):
--   psql "$DATABASE_URL" -f supabase/migrations/tests/merchant_balance_gateway_origin_guard.sql
--
-- Runs inside a transaction and rolls back — no data is persisted.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  v_merchant_id uuid := '9c000000-0000-4000-8000-000000000901';
  v_korapay_txn uuid := gen_random_uuid();
  v_paystack_txn uuid := gen_random_uuid();
  v_manual_txn uuid := gen_random_uuid();
  v_available numeric;
  v_earned numeric;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'balance-guard@example.com',
    'Balance Guard Store',
    'balance-guard-store'
  );

  -- ---- Korapay (CUSTODIED): completing it MUST credit merchant_balances. ----
  INSERT INTO public.transactions (
    id, merchant_id, transaction_type, amount, currency, status, gateway, merchant_amount
  ) VALUES (
    v_korapay_txn, v_merchant_id, 'payment', 10000, 'NGN', 'pending', 'korapay', 9800
  );
  UPDATE public.transactions SET status = 'completed' WHERE id = v_korapay_txn;

  SELECT available_balance, total_earned INTO v_available, v_earned
  FROM public.merchant_balances
  WHERE merchant_id = v_merchant_id AND currency = 'NGN';

  IF COALESCE(v_available, 0) IS DISTINCT FROM 9800
     OR COALESCE(v_earned, 0) IS DISTINCT FROM 9800 THEN
    RAISE EXCEPTION
      'Korapay (custodied) payment must credit merchant_balances: expected 9800/9800, got %/%',
      v_available, v_earned;
  END IF;

  -- ---- Paystack (DIRECT-SETTLE): completing it must NOT credit anything. ----
  INSERT INTO public.transactions (
    id, merchant_id, transaction_type, amount, currency, status, gateway, merchant_amount
  ) VALUES (
    v_paystack_txn, v_merchant_id, 'payment', 500000, 'NGN', 'pending', 'paystack', 490000
  );
  UPDATE public.transactions SET status = 'completed' WHERE id = v_paystack_txn;

  SELECT available_balance INTO v_available
  FROM public.merchant_balances
  WHERE merchant_id = v_merchant_id AND currency = 'NGN';

  IF v_available IS DISTINCT FROM 9800 THEN
    RAISE EXCEPTION
      'Paystack (direct-settle) payment must NOT credit merchant_balances (phantom balance regression): expected 9800, got %',
      v_available;
  END IF;

  -- ---- Manual (no gateway settlement): must NOT credit either. ----
  INSERT INTO public.transactions (
    id, merchant_id, transaction_type, amount, currency, status, gateway, merchant_amount
  ) VALUES (
    v_manual_txn, v_merchant_id, 'payment', 24000, 'NGN', 'pending', 'manual', NULL
  );
  UPDATE public.transactions SET status = 'completed' WHERE id = v_manual_txn;

  SELECT available_balance INTO v_available
  FROM public.merchant_balances
  WHERE merchant_id = v_merchant_id AND currency = 'NGN';

  IF v_available IS DISTINCT FROM 9800 THEN
    RAISE EXCEPTION
      'Manual payment must NOT credit merchant_balances: expected 9800, got %',
      v_available;
  END IF;

  RAISE NOTICE 'merchant_balance_gateway_origin_guard: PASS (korapay credited; paystack + manual excluded)';
END $$;

ROLLBACK;
