-- Normalize merchant country values ahead of the multi-country currency rollout.
-- Goal: every merchant should carry an ISO 3166-1 alpha-2 country code so that
-- currency and tax logic can key off a stable value instead of free text or nulls.
--
-- Two safe backfills, both idempotent by construction:
--   1. Legacy free-text "Nigeria" becomes the alpha-2 value "NG".
--   2. Rows with an unset country but a Naira payout are assumed Nigerian ("NG").
--
-- Re-running is harmless: once a row already reads "NG" neither statement matches
-- it again, so this can be replayed without changing any additional rows.

UPDATE public.merchants
SET country = 'NG'
WHERE country = 'Nigeria';

UPDATE public.merchants
SET country = 'NG'
WHERE country IS NULL
  AND payout_currency = 'NGN';
