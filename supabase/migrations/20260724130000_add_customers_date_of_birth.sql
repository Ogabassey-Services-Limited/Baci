-- Adds date_of_birth to public.customers to power the Super Quiz 18+ age gate.
--
-- The quiz age gate (enforceQuizAgeGate) reads customers.date_of_birth to
-- verify a player is 18+ before allowing entry when QUIZ_PHASE=production.
-- Until now that column did not exist, so the gate — and any write to it —
-- would have errored (42703) the moment production flipped. This adds it as a
-- nullable date. A missing value is treated by the gate as "no adult profile
-- on file" and fails closed (403), which is the intended behaviour.
--
-- The column inherits the table-level grants + Row-Level Security already on
-- public.customers (identical protection to the existing email/phone/address
-- PII columns), so a customer can only read and update their own row — via the
-- storefront customer API (web) and the set_customer_date_of_birth RPC (mobile).
-- It is NOT an identity/KYC field.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.customers.date_of_birth IS
  'Customer date of birth (nullable date). Powers the Super Quiz 18+ age gate; not an identity/KYC field.';
