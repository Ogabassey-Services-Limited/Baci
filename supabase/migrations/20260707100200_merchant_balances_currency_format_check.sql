-- Widen the merchant_balances currency guard for the multi-country rollout.
--
-- The previous guard was a fixed allow-list of eight codes. Once merchant payout
-- currencies begin propagating onto balances, live foreign merchants (for example
-- India and the UAE) would fail that allow-list. Swap it for a format-only rule:
-- any three uppercase ASCII letters, i.e. an ISO 4217 style code.
--
-- Every existing balance row stores 'NGN', which already matches the new pattern,
-- so this swap does not reject any current data.

ALTER TABLE public.merchant_balances
  DROP CONSTRAINT IF EXISTS merchant_balances_currency_check;

ALTER TABLE public.merchant_balances
  ADD CONSTRAINT merchant_balances_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');
