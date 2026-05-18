-- Allow Klump-settled order payments to use the existing merchant settlement
-- ledger. This only widens the gateway check; source types stay unchanged.

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
    'klump'
  ]));
