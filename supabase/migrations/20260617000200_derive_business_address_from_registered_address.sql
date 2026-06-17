-- PR-F (merchant-data-drift remediation) — Address unification.
--
-- Problem (see docs/merchant-data-drift-audit.md, "theme 4" + "PR-F"):
-- `merchants.business_address` (free-text, read by ~26 places incl. the
-- storefront footer + LocalBusiness JSON-LD) and `merchants.registered_address`
-- (structured jsonb, used for tax/invoices) were split with NO sync, so they
-- drifted silently — a stale free-text address survived after the structured
-- one was corrected.
--
-- Decision (owner, 2026-06-16): make `registered_address` (structured) the
-- canonical source of truth and keep `business_address` as a DERIVED column so
-- the two can never diverge. All 26 readers stay untouched; only the derivation
-- mechanism is new.
--
-- WHY A BEFORE TRIGGER, NOT A STORED GENERATED COLUMN
-- ---------------------------------------------------
-- A `GENERATED ALWAYS AS (format_merchant_address(registered_address)) STORED`
-- column is the more "modern" mechanism and IS expressible here (our format
-- function is IMMUTABLE, the only hard requirement for generated columns —
-- PostgreSQL 18 §5.4). We deliberately chose a BEFORE INSERT OR UPDATE trigger
-- instead, for the lowest blast radius:
--   1. `business_address` already exists as a plain text column read by ~26
--      sites and carries a column COMMENT ("displayed in storefront footer").
--      Converting it to generated requires DROP COLUMN + ADD COLUMN, which
--      churns the PostgREST schema cache and drops the comment/any dependents.
--   2. A generated column is NOT writable by application code: every existing
--      writer that still sets `business_address` directly (mobile free-text
--      Business Address field, pre-UI-migration) would HARD-ERROR
--      ("cannot insert a non-DEFAULT value into column business_address").
--      A BEFORE trigger instead OVERWRITES whatever the app sends, so the
--      derivation is backward-compatible and ships before the optional UI
--      change. The free-text writer is harmlessly ignored, not broken.
--   3. The trigger catches EVERY heterogeneous writer (mobile writes `merchants`
--      directly; web tax writes via the route) in one place.
-- The format function is still declared IMMUTABLE so a future move to a
-- generated column needs no function change.
--
-- Recompute rule: on EVERY insert/update, `business_address` is set to
-- `format_merchant_address(registered_address)`. When `registered_address` is
-- null/empty, that yields NULL — a cleared address never leaves a stale
-- free-text value behind.

-- 1. IMMUTABLE formatter: comma-join the non-empty structured parts.
--    Mirrors the shared TS `formatMerchantAddress()` (parity-tested).
--    Returns NULL (never an empty string) for null/empty input.
CREATE OR REPLACE FUNCTION public.format_merchant_address(p_address jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(
    array_to_string(
      ARRAY(
        SELECT btrim(part)
        FROM unnest(
          ARRAY[
            p_address->>'street',
            p_address->>'city',
            p_address->>'state',
            p_address->>'postal_code'
          ]
        ) AS part
        WHERE part IS NOT NULL
          AND btrim(part) <> ''
      ),
      ', '
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.format_merchant_address(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.format_merchant_address(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.format_merchant_address(jsonb) FROM authenticated;

COMMENT ON FUNCTION public.format_merchant_address(jsonb)
IS 'Formats a structured registered_address jsonb into the free-text business_address (comma-joined non-empty street/city/state/postal_code). Returns NULL for null/empty input. IMMUTABLE, parity-tested against the shared TS formatMerchantAddress().';

-- 2. Trigger function: derive business_address from registered_address on every
--    insert and on updates that touch either address column. This catches legacy
--    direct business_address writers while avoiding work on unrelated updates.
CREATE OR REPLACE FUNCTION public.sync_business_address_from_registered()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.registered_address IS DISTINCT FROM OLD.registered_address
     OR NEW.business_address IS DISTINCT FROM OLD.business_address THEN
    NEW.business_address := public.format_merchant_address(NEW.registered_address);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_business_address_from_registered() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_business_address_from_registered() FROM anon;
REVOKE ALL ON FUNCTION public.sync_business_address_from_registered() FROM authenticated;

COMMENT ON FUNCTION public.sync_business_address_from_registered()
IS 'Keeps merchants.business_address (free-text, footer/JSON-LD) derived from the canonical structured merchants.registered_address. PR-F address unification.';

DROP TRIGGER IF EXISTS zz_sync_business_address_from_registered ON public.merchants;
CREATE TRIGGER zz_sync_business_address_from_registered
BEFORE INSERT OR UPDATE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.sync_business_address_from_registered();

-- 3. One-time back-fill: derive business_address for every existing row from its
--    current registered_address. Rows whose structured address is null/empty get
--    business_address = NULL (no stale free-text retained).
UPDATE public.merchants
SET business_address = public.format_merchant_address(registered_address)
WHERE business_address IS DISTINCT FROM public.format_merchant_address(registered_address);

COMMENT ON COLUMN public.merchants.business_address
IS 'Derived (do not write directly): comma-joined free-text form of registered_address, kept in sync by zz_sync_business_address_from_registered. Displayed in storefront footer. PR-F address unification.';
