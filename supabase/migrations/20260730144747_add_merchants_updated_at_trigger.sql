-- Keep every merchant write observable to optimistic-concurrency callers.
-- `clock_timestamp()` plus the old-token floor advances even for multiple
-- updates in one transaction, where `now()` alone would remain unchanged.
CREATE OR REPLACE FUNCTION private.set_merchants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := GREATEST(
    pg_catalog.clock_timestamp(),
    OLD.updated_at + interval '1 microsecond'
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.set_merchants_updated_at()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.set_merchants_updated_at()
  FROM PUBLIC, anon, authenticated;

-- PostgreSQL fires same-kind triggers alphabetically. Remove the legacy
-- transaction-stable `now()` trigger so it cannot overwrite this strict token.
DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
DROP TRIGGER IF EXISTS merchants_set_updated_at ON public.merchants;
CREATE TRIGGER merchants_set_updated_at
BEFORE UPDATE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION private.set_merchants_updated_at();

COMMENT ON FUNCTION private.set_merchants_updated_at() IS
  'Forces a strictly newer merchants.updated_at token for every row update, including direct writes.';
