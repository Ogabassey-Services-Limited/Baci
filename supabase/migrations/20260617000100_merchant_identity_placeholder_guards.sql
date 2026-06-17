-- PR-A (theme 6): reject known placeholder/dummy values on merchant identity fields.
--
-- Backstop for the drift that wrote "456 Oak Avenue, New City, State, 12345" / "1234567890" / "123 Main Street"
-- to production. Added NOT VALID so existing rows are NOT retro-validated (some may still be dirty); new and
-- updated rows ARE checked immediately. Follow-up: data-cleanup pass across all merchants, then VALIDATE CONSTRAINT.
-- Patterns are intentionally tight (distinctive dummy fragments) to avoid rejecting legitimate addresses.

-- Clean known dirty rows before adding NOT VALID constraints. PostgreSQL still
-- enforces NOT VALID CHECK constraints for future UPDATEs, so leaving existing
-- placeholder values would block unrelated merchant settings saves.
UPDATE public.merchants
   SET business_address = NULL
 WHERE business_address ILIKE '%New City, State%'
    OR business_address ILIKE '%Oak Avenue, New City%';

UPDATE public.merchants
   SET phone = NULL
 WHERE btrim(phone) IN ('1234567890', '0000000000');

UPDATE public.merchants
   SET support_phone = NULL
 WHERE btrim(support_phone) IN ('1234567890', '0000000000');

UPDATE public.merchants
   SET registered_address = NULL
 WHERE COALESCE(registered_address->>'street', '') ILIKE '123 Main St%'
   AND COALESCE(registered_address->>'city', '') ILIKE 'New City'
   AND COALESCE(registered_address->>'state', '') ILIKE 'State'
   AND COALESCE(registered_address->>'postal_code', registered_address->>'postalCode', '') = '12345';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.merchants'::regclass
       AND conname = 'merchants_business_address_not_placeholder'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_business_address_not_placeholder
      CHECK (
        business_address IS NULL
        OR (business_address NOT ILIKE '%New City, State%'
            AND business_address NOT ILIKE '%Oak Avenue, New City%')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.merchants'::regclass
       AND conname = 'merchants_phone_not_placeholder'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_phone_not_placeholder
      CHECK (phone IS NULL OR btrim(phone) NOT IN ('1234567890', '0000000000')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.merchants'::regclass
       AND conname = 'merchants_support_phone_not_placeholder'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_support_phone_not_placeholder
      CHECK (support_phone IS NULL OR btrim(support_phone) NOT IN ('1234567890', '0000000000')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.merchants'::regclass
       AND conname = 'merchants_registered_street_not_placeholder'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_registered_street_not_placeholder
      CHECK (
        registered_address IS NULL
        OR NOT (
          COALESCE(registered_address->>'street', '') ILIKE '123 Main St%'
          AND COALESCE(registered_address->>'city', '') ILIKE 'New City'
          AND COALESCE(registered_address->>'state', '') ILIKE 'State'
          AND COALESCE(registered_address->>'postal_code', registered_address->>'postalCode', '') = '12345'
        )
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT merchants_business_address_not_placeholder ON public.merchants IS
  'Drift backstop (2026-06): rejects the seeded dummy business address. Tight patterns; NOT VALID pending a cleanup + VALIDATE follow-up.';
COMMENT ON CONSTRAINT merchants_phone_not_placeholder ON public.merchants IS
  'Drift backstop (2026-06): rejects seeded dummy phone values. NOT VALID pending cleanup.';
COMMENT ON CONSTRAINT merchants_support_phone_not_placeholder ON public.merchants IS
  'Drift backstop (2026-06): rejects seeded dummy support phone values. NOT VALID pending cleanup.';
COMMENT ON CONSTRAINT merchants_registered_street_not_placeholder ON public.merchants IS
  'Drift backstop (2026-06): rejects the complete seeded dummy registered-address object without blocking real Main Street addresses. NOT VALID pending cleanup.';
