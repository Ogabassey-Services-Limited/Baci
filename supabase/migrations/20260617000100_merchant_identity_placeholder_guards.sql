-- PR-A (theme 6): reject known placeholder/dummy values on merchant identity fields.
--
-- Backstop for the drift that wrote "456 Oak Avenue, New City, State, 12345" / "1234567890" / "123 Main Street"
-- to production. Added NOT VALID so existing rows are NOT retro-validated (some may still be dirty); new and
-- updated rows ARE checked immediately. Follow-up: data-cleanup pass across all merchants, then VALIDATE CONSTRAINT.
-- Patterns are intentionally tight (distinctive dummy fragments) to avoid rejecting legitimate addresses.

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_business_address_not_placeholder
  CHECK (
    business_address IS NULL
    OR (business_address NOT ILIKE '%New City, State%'
        AND business_address NOT ILIKE '%Oak Avenue, New City%')
  ) NOT VALID;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_phone_not_placeholder
  CHECK (phone IS NULL OR btrim(phone) NOT IN ('1234567890', '0000000000')) NOT VALID;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_support_phone_not_placeholder
  CHECK (support_phone IS NULL OR btrim(support_phone) NOT IN ('1234567890', '0000000000')) NOT VALID;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_registered_street_not_placeholder
  CHECK (
    registered_address IS NULL
    OR COALESCE(registered_address->>'street', '') NOT ILIKE '123 Main St%'
  ) NOT VALID;

COMMENT ON CONSTRAINT merchants_business_address_not_placeholder ON public.merchants IS
  'Drift backstop (2026-06): rejects the seeded dummy business address. Tight patterns; NOT VALID pending a cleanup + VALIDATE follow-up.';