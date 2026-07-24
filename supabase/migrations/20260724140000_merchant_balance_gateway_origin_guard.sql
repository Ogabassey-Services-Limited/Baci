-- Gateway-origin guard for merchant_balances (phantom-balance money-bug fix).
--
-- ROOT CAUSE: `update_merchant_balance()` credited `merchant_balances` for EVERY
-- completed `transaction_type='payment'` regardless of gateway. `merchant_balances`
-- is the withdrawable ledger read by the payout route, which disburses via Korapay
-- `sendPayout`. Direct-settle gateways (paystack, and the BNPL rails klump/
-- credit_direct/credpal) settle straight to the MERCHANT'S OWN account — Baci never
-- holds those funds — so crediting them created a phantom withdrawable balance that,
-- once the Korapay disbursement float is funded, would let Baci pay the merchant a
-- second time for money it does not custody.
--
-- FIX (fail-closed allowlist): only a Korapay-collected payment — the one rail whose
-- funds land in Baci's own Korapay account and can actually be disbursed by the
-- payout route — may create a withdrawable balance. Every other gateway is excluded:
--   * paystack / klump / credit_direct / credpal -> settle directly to the merchant.
--   * manual                                     -> no real gateway settlement.
--   * juicyway                                   -> custodied, but tracked in the
--     separate `merchant_wallets` ledger; not in the Korapay disbursement float.
-- Extend the allowlist ONLY after confirming the gateway funds the disbursable
-- Korapay float. NULL `merchant_amount` never credits (guards mis-recorded rows).
--
-- Go-forward only. Existing phantom rows in `merchant_balances` are reconciled
-- separately via an owner-approved re-run of a corrected `backfill_merchant_balances`
-- (see docs); they are inert until Korapay collection is enabled, which is gated OFF.
-- The `payout` branch is unchanged.

CREATE OR REPLACE FUNCTION "public"."update_merchant_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.transaction_type = 'payment' THEN
            -- Fail-closed: only Korapay-custodied funds are withdrawable via the
            -- Korapay payout float. See migration header for the excluded gateways.
            IF NEW.gateway = 'korapay' AND NEW.merchant_amount IS NOT NULL THEN
                INSERT INTO merchant_balances (merchant_id, currency, available_balance, total_earned)
                VALUES (NEW.merchant_id, NEW.currency, NEW.merchant_amount, NEW.merchant_amount)
                ON CONFLICT (merchant_id, currency)
                DO UPDATE SET
                    available_balance = merchant_balances.available_balance + NEW.merchant_amount,
                    total_earned = merchant_balances.total_earned + NEW.merchant_amount,
                    updated_at = NOW();
            END IF;
        ELSIF NEW.transaction_type = 'payout' THEN
            UPDATE merchant_balances
            SET available_balance = available_balance - NEW.amount,
                total_withdrawn = total_withdrawn + NEW.amount,
                updated_at = NOW()
            WHERE merchant_id = NEW.merchant_id AND currency = NEW.currency;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
