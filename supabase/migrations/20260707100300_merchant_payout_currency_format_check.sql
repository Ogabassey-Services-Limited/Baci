-- Guarantee merchants.payout_currency is always a well-formed ISO-4217-style
-- code (three uppercase ASCII letters).
--
-- Why: the client-side currency resolver and the order-writing routine both
-- resolve payout_currency first. With this guard in place the two can never
-- disagree on a merchant's currency, because a blank/malformed payout value —
-- the only input on which their fallback chains differ — can no longer exist.
--
-- All current rows already satisfy the pattern (verified against production);
-- the normalization statements below are defensive no-ops today.

UPDATE public.merchants
SET payout_currency = upper(trim(payout_currency))
WHERE payout_currency IS NOT NULL
  AND payout_currency <> upper(trim(payout_currency));

UPDATE public.merchants
SET payout_currency = 'NGN'
WHERE payout_currency IS NULL
  OR payout_currency !~ '^[A-Z]{3}$';

-- A CHECK constraint passes NULL values, so the column must also be NOT NULL
-- for the guarantee to hold (safe: the column has DEFAULT 'NGN' and the
-- normalization above removes any remaining NULLs).
ALTER TABLE public.merchants
  ALTER COLUMN payout_currency SET NOT NULL;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_payout_currency_check;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_payout_currency_check
  CHECK (payout_currency ~ '^[A-Z]{3}$');
