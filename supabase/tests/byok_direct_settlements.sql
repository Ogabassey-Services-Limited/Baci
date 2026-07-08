-- =============================================
-- REGRESSION TEST: BYOK direct-to-merchant settlement fork
--   Locks the money-path semantics established by migration
--   20260708140644_byok_direct_settlements.sql:
--
--     1. record_merchant_settlement_v2(..., 'direct_to_merchant') writes an
--        informational ledger row (status 'direct') and NEVER creates or
--        credits a merchant_wallets row and NEVER parks an upcoming/pending
--        balance. The row is stamped settlement_notified = true and status
--        'direct' (not 'settled'), so neither process_due_settlements
--        (status = 'pending') nor the process-settlements notification query
--        (status = 'settled' AND settlement_notified = false) can pick it up.
--     2. A replayed direct call on the same
--        (source_type, source_id, gateway_reference) returns NULL and writes
--        no second row (idempotent).
--     3. The legacy path is unchanged: p_settlement_type NULL delegates to the
--        10-arg record_merchant_settlement — korapay credits available_balance
--        immediately (+ a wallet_transactions credit); paystack parks the
--        amount in upcoming_balance with upcoming_count incremented.
--
-- USAGE:
--   This is a behavioral regression test for a Supabase preview branch, not a
--   local-only script. Run it with the Supabase MCP execute_sql tool (or
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f
--   supabase/tests/byok_direct_settlements.sql) against the preview branch the
--   migration was applied to, AFTER
--   20260708140644_byok_direct_settlements.sql has been applied there.
--
-- SAFETY:
--   Everything runs inside the single BEGIN; ... ROLLBACK; transaction below,
--   so the script is replay-safe and side-effect-free even against a database
--   with real data. Assertions carry distinct RAISE EXCEPTION messages naming
--   the exact invariant that failed, so failures are identifiable by message
--   text — physical line numbers shift whenever this file is reformatted.
-- =============================================

BEGIN;

DO $$
DECLARE
  v_direct_merchant   uuid := 'b70c0000-0000-4000-8000-0000000d1a01';
  v_direct_user       uuid := 'b70c0000-0000-4000-8000-0000000d1a02';
  v_kora_merchant     uuid := 'b70c0000-0000-4000-8000-0000000d1b01';
  v_kora_user         uuid := 'b70c0000-0000-4000-8000-0000000d1b02';
  v_pay_merchant      uuid := 'b70c0000-0000-4000-8000-0000000d1c01';
  v_pay_user          uuid := 'b70c0000-0000-4000-8000-0000000d1c02';

  v_direct_source     uuid := 'b70c0000-0000-4000-8000-0000000d2a01';
  v_kora_source       uuid := 'b70c0000-0000-4000-8000-0000000d2b01';
  v_pay_source        uuid := 'b70c0000-0000-4000-8000-0000000d2c01';

  v_settlement_id     uuid;
  v_replay_id         uuid;
  v_status            text;
  v_notified          boolean;
  v_wallet_id         uuid;
  v_net               numeric(12,2);
  v_available         numeric(12,2);
  v_upcoming          numeric(12,2);
  v_upcoming_count    integer;
  n                   integer;
BEGIN
  -- Act as service_role (the only role allowed to call the RPC) for the whole
  -- test; auth.role() reads the jwt claim GUC.
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  INSERT INTO public.merchants (id, user_id, email, business_name, slug) VALUES
    (v_direct_merchant, v_direct_user, 'byok-direct@example.com',
     'BYOK Direct Store', 'byok-direct-settlement-store'),
    (v_kora_merchant, v_kora_user, 'byok-kora@example.com',
     'Korapay Legacy Store', 'byok-korapay-legacy-store'),
    (v_pay_merchant, v_pay_user, 'byok-pay@example.com',
     'Paystack Legacy Store', 'byok-paystack-legacy-store');

  -- ------------------------------------------------------------------
  -- 1. Direct-to-merchant path: informational row, no wallet, no pending.
  -- ------------------------------------------------------------------
  v_settlement_id := public.record_merchant_settlement_v2(
    v_direct_merchant, 'order', v_direct_source, 'paypal', 'BAC-direct-0001',
    1500.00, 0, 0, 'PayPal capture', '{}'::jsonb, 'direct_to_merchant'
  );

  IF v_settlement_id IS NULL THEN
    RAISE EXCEPTION 'direct settlement should return a new row id, got NULL';
  END IF;

  SELECT status, wallet_id, settlement_notified, net_amount
    INTO v_status, v_wallet_id, v_notified, v_net
    FROM public.merchant_settlements
   WHERE id = v_settlement_id;

  IF v_status <> 'direct' THEN
    RAISE EXCEPTION 'direct settlement status must be direct, got %', v_status;
  END IF;

  IF v_wallet_id IS NOT NULL THEN
    RAISE EXCEPTION 'direct settlement must not reference a wallet, got wallet_id %', v_wallet_id;
  END IF;

  IF v_notified IS NOT TRUE THEN
    RAISE EXCEPTION 'direct settlement must be pre-marked settlement_notified=true so no email fires, got %', v_notified;
  END IF;

  IF v_net <> 1500.00 THEN
    RAISE EXCEPTION 'direct settlement net_amount must equal gross when fees are zero, got %', v_net;
  END IF;

  -- No merchant_wallets row may have been created or credited for this merchant.
  SELECT count(*) INTO n
    FROM public.merchant_wallets
   WHERE merchant_id = v_direct_merchant;
  IF n <> 0 THEN
    RAISE EXCEPTION 'direct settlement must not create/credit a wallet, found % wallet row(s)', n;
  END IF;

  -- Exclusion proof: a 'direct' row can never match process_due_settlements
  -- (status = pending) nor the notification cron (status = settled AND
  -- settlement_notified = false).
  SELECT count(*) INTO n
    FROM public.merchant_settlements
   WHERE id = v_settlement_id
     AND (status = 'pending'
          OR (status = 'settled' AND settlement_notified = false));
  IF n <> 0 THEN
    RAISE EXCEPTION 'direct settlement is reachable by a settlement/notification path (matched % filter row)', n;
  END IF;

  -- ------------------------------------------------------------------
  -- 2. Replay safety: same (source_type, source_id, gateway_reference).
  -- ------------------------------------------------------------------
  v_replay_id := public.record_merchant_settlement_v2(
    v_direct_merchant, 'order', v_direct_source, 'paypal', 'BAC-direct-0001',
    1500.00, 0, 0, 'PayPal capture', '{}'::jsonb, 'direct_to_merchant'
  );

  IF v_replay_id IS NOT NULL THEN
    RAISE EXCEPTION 'replayed direct settlement must return NULL, got %', v_replay_id;
  END IF;

  SELECT count(*) INTO n
    FROM public.merchant_settlements
   WHERE source_type = 'order'
     AND source_id = v_direct_source
     AND gateway_reference = 'BAC-direct-0001';
  IF n <> 1 THEN
    RAISE EXCEPTION 'replayed direct settlement must not write a second row, found % row(s)', n;
  END IF;

  -- ------------------------------------------------------------------
  -- 3a. Legacy korapay path (p_settlement_type NULL): instant wallet credit.
  -- ------------------------------------------------------------------
  v_settlement_id := public.record_merchant_settlement_v2(
    v_kora_merchant, 'order', v_kora_source, 'korapay', 'BAC-kora-0001',
    1000.00, 25.00, 20.00, 'Korapay order', '{}'::jsonb, NULL
  );

  IF v_settlement_id IS NULL THEN
    RAISE EXCEPTION 'legacy korapay settlement should return a new row id, got NULL';
  END IF;

  SELECT available_balance, upcoming_balance
    INTO v_available, v_upcoming
    FROM public.merchant_wallets
   WHERE merchant_id = v_kora_merchant;

  IF v_available <> 955.00 THEN
    RAISE EXCEPTION 'legacy korapay must credit available_balance with net 955.00, got %', v_available;
  END IF;

  IF v_upcoming <> 0 THEN
    RAISE EXCEPTION 'legacy korapay must not park an upcoming balance, got %', v_upcoming;
  END IF;

  SELECT count(*) INTO n
    FROM public.wallet_transactions
   WHERE merchant_id = v_kora_merchant
     AND type = 'credit'
     AND amount = 955.00
     AND status = 'completed';
  IF n < 1 THEN
    RAISE EXCEPTION 'legacy korapay must write a completed wallet_transactions credit, found %', n;
  END IF;

  -- ------------------------------------------------------------------
  -- 3b. Legacy paystack path (p_settlement_type NULL): pending upcoming balance.
  -- ------------------------------------------------------------------
  v_settlement_id := public.record_merchant_settlement_v2(
    v_pay_merchant, 'order', v_pay_source, 'paystack', 'BAC-pay-0001',
    2000.00, 30.00, 40.00, 'Paystack order', '{}'::jsonb, NULL
  );

  IF v_settlement_id IS NULL THEN
    RAISE EXCEPTION 'legacy paystack settlement should return a new row id, got NULL';
  END IF;

  SELECT available_balance, upcoming_balance, upcoming_count
    INTO v_available, v_upcoming, v_upcoming_count
    FROM public.merchant_wallets
   WHERE merchant_id = v_pay_merchant;

  IF v_upcoming <> 1930.00 THEN
    RAISE EXCEPTION 'legacy paystack must park net 1930.00 in upcoming_balance, got %', v_upcoming;
  END IF;

  IF v_upcoming_count <> 1 THEN
    RAISE EXCEPTION 'legacy paystack must increment upcoming_count to 1, got %', v_upcoming_count;
  END IF;

  IF v_available <> 0 THEN
    RAISE EXCEPTION 'legacy paystack must not credit available_balance yet, got %', v_available;
  END IF;

  RAISE NOTICE 'OK: BYOK direct settlement writes an informational row with no wallet/upcoming/email exposure, is replay-safe, and the legacy korapay/paystack paths are unchanged';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
