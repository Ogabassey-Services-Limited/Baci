-- Phase A — A0 migration #2 (Δ-48, Δ-53)
--
-- Drops + recreates the `merchant_settlements.gateway` and `source_type`
-- CHECK constraints to include `juicyway` and `domain_purchase`. Live
-- callers in `apps/web/src/app/api/payments/webhook/route.ts:1693` pass
-- `source_type='domain_purchase'` and `apps/web/src/app/api/payments/juicyway/webhook/route.ts:478`
-- passes `gateway='juicyway'`. Both have been silently failing the existing
-- CHECK; once A0's settlement-idempotency migration tightens the
-- INSERT to ON CONFLICT DO NOTHING, the same call sites would surface
-- previously-silent CHECK violations as loud errors. Allow them first.
--
-- This migration MUST run before `20260509110200_settlement_idempotency.sql`.

ALTER TABLE merchant_settlements
  DROP CONSTRAINT IF EXISTS merchant_settlements_gateway_check;
ALTER TABLE merchant_settlements
  ADD CONSTRAINT merchant_settlements_gateway_check
  CHECK (gateway = ANY (ARRAY[
    'paystack',
    'korapay',
    'credit_direct',
    'kuda',
    'manual',
    'juicyway'
  ]));

ALTER TABLE merchant_settlements
  DROP CONSTRAINT IF EXISTS merchant_settlements_source_type_check;
ALTER TABLE merchant_settlements
  ADD CONSTRAINT merchant_settlements_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'order',
    'vtu_commission',
    'refund',
    'adjustment',
    'domain_purchase'
  ]));
