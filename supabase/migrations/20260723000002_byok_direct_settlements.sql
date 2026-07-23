-- BYOK direct-to-merchant settlement fork (Phase 2.6).
--
-- On the platform rails, record_merchant_settlement books money that Baci
-- collected and owes the merchant: korapay credits merchant_wallets
-- available_balance immediately; every other gateway parks the amount in
-- upcoming_balance until process_due_settlements moves it to available_balance
-- and the process-settlements cron emails a "funds settled" notice.
--
-- Under BYOK (PayPal today, Stripe/Flutterwave later) the customer paid the
-- merchant's own gateway account, so the money is already with the merchant.
-- Booking it the platform-rail way would create a phantom wallet liability and
-- fire a false "funds settled" email. This adds a settlement type that writes
-- an informational ledger row only, with no wallet movement and no email.
--
-- Design note (function signature): appending p_settlement_type to
-- record_merchant_settlement cannot be done with create-or-replace, because
-- adding a parameter yields a separate 11-arg function. An 11-arg form with a
-- trailing default collides with the existing 10-arg (all-required) form under
-- PostgREST name resolution (PGRST203) — the exact ambiguity that migrations
-- 20260510000100 / 20260510001000 removed. So the fork lives in a new,
-- distinctly named function, record_merchant_settlement_v2. Both names then
-- resolve to a single unambiguous overload each, and every existing
-- record_merchant_settlement caller stays byte-for-byte unchanged.

-- 1. Widen the ledger CHECK constraints so a direct settlement row is
--    representable: a 'direct' status and the 'paypal' gateway. Every existing
--    allowed value is preserved; only the new values are appended.
ALTER TABLE public.merchant_settlements
  DROP CONSTRAINT IF EXISTS merchant_settlements_status_check;
ALTER TABLE public.merchant_settlements
  ADD CONSTRAINT merchant_settlements_status_check
  CHECK (status = ANY (ARRAY[
    'pending',
    'processing',
    'settled',
    'failed',
    'cancelled',
    'direct'
  ]));

ALTER TABLE public.merchant_settlements
  DROP CONSTRAINT IF EXISTS merchant_settlements_gateway_check;
ALTER TABLE public.merchant_settlements
  ADD CONSTRAINT merchant_settlements_gateway_check
  CHECK (gateway = ANY (ARRAY[
    'paystack',
    'korapay',
    'credit_direct',
    'kuda',
    'manual',
    'juicyway',
    'klump',
    'paypal'
  ]));

-- 2. record_merchant_settlement_v2 — the go-forward entry point that adds a
--    p_settlement_type fork on top of the untouched 10-arg
--    record_merchant_settlement.
--
--    p_settlement_type:
--      'direct_to_merchant' -> BYOK path: write an informational ledger row
--        (status 'direct'), never touch merchant_wallets, never park a
--        pending/upcoming balance, and pre-set settlement_notified so the
--        process-settlements cron never emails a settled notice for money the
--        merchant already holds.
--      NULL (or any other value) -> legacy platform-rail behavior, delegated
--        verbatim to public.record_merchant_settlement so the collect-then-
--        payout path keeps a single source of truth.
CREATE OR REPLACE FUNCTION public.record_merchant_settlement_v2(
  p_merchant_id       uuid,
  p_source_type       text,
  p_source_id         uuid,
  p_gateway           text,
  p_gateway_reference text,
  p_gross_amount      numeric,
  p_gateway_fee       numeric,
  p_platform_fee      numeric,
  p_description       text,
  p_metadata          jsonb,
  p_settlement_type   text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_net_amount    numeric(12,2);
  v_settlement_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_merchant_settlement_v2 requires service_role';
  END IF;

  IF p_settlement_type IS DISTINCT FROM 'direct_to_merchant' THEN
    -- Legacy platform-rail path: single source of truth stays in the
    -- untouched 10-arg function (wallet credit / upcoming balance / email).
    RETURN public.record_merchant_settlement(
      p_merchant_id,
      p_source_type,
      p_source_id,
      p_gateway,
      p_gateway_reference,
      p_gross_amount,
      p_gateway_fee,
      p_platform_fee,
      p_description,
      p_metadata
    );
  END IF;

  -- BYOK direct-to-merchant path: informational ledger row only. wallet_id is
  -- left NULL (no wallet is created or credited), the row is stamped settled
  -- same-day, and settlement_notified is pre-set so no email path picks it up.
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;

  INSERT INTO merchant_settlements (
    merchant_id, wallet_id, source_type, source_id, gateway,
    gateway_reference, gross_amount, gateway_fee, platform_fee, net_amount,
    payment_date, expected_settlement_date, actual_settlement_date,
    description, status, settlement_notified, notification_sent_at, metadata
  ) VALUES (
    p_merchant_id, NULL, p_source_type, p_source_id, p_gateway,
    p_gateway_reference, p_gross_amount, p_gateway_fee, p_platform_fee,
    v_net_amount, NOW(), CURRENT_DATE, CURRENT_DATE,
    COALESCE(p_description, 'Paid directly to merchant'),
    'direct', true, NOW(), COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (source_type, source_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL AND status != 'cancelled'
    DO NOTHING
  RETURNING id INTO v_settlement_id;

  -- On conflict (replayed webhook/capture) v_settlement_id is NULL and no new
  -- row is written; the caller treats NULL as "already recorded".
  RETURN v_settlement_id;
END $$;

ALTER FUNCTION public.record_merchant_settlement_v2(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.record_merchant_settlement_v2(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_merchant_settlement_v2(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb, text
) TO service_role;

COMMENT ON FUNCTION public.record_merchant_settlement_v2(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb, text
) IS
  'Settlement recorder with a p_settlement_type fork. direct_to_merchant writes an informational ledger row (status direct) with no wallet movement, no upcoming balance, and settlement_notified pre-set so no settlement email fires; any other value delegates to the 10-arg record_merchant_settlement. Distinct name avoids PostgREST overload ambiguity with record_merchant_settlement; service_role only.';

-- 3. process_due_settlements is intentionally left unchanged. Its loop filters
--    WHERE status = 'pending', and direct rows are inserted with status
--    'direct', so they are naturally excluded and never flipped to settled or
--    surfaced to the process-settlements cron's notification query (which
--    filters status = 'settled' AND settlement_notified = false).
