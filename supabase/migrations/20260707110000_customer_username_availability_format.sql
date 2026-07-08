-- Follow-up to 20260707100000_customer_usernames.sql.
--
-- Bug: `is_customer_username_available` (the UI availability probe) checked only
-- reserved-name and collision status — it SKIPPED the charset/length format
-- rule that both `set_customer_username` and the `validate_customer_username`
-- write-guard enforce. So the probe returned `true` for a malformed value
-- (e.g. `"ab"` too short, `"_bad"`, `"a..b"`, `"a b"`), telling the user it was
-- available right up until `set_customer_username` rejected it.
--
-- Fix: extract the shared format predicate and apply it in the probe so its
-- answer matches what set/validate will actually accept.

-- Single source of truth for the username format rule: 3-20 chars, a-z 0-9 plus
-- single `.`/`_` separators, must start and end alphanumeric, no consecutive
-- separators. Normalizes (lower + btrim) internally so callers can pass raw or
-- pre-normalized input. Returns FALSE for NULL/blank (never TRUE) so it is safe
-- to AND into availability checks.
CREATE OR REPLACE FUNCTION public.is_valid_username_format(p_username text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_username IS NOT NULL
    AND pg_catalog.lower(pg_catalog.btrim(p_username)) ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$'
    AND pg_catalog.lower(pg_catalog.btrim(p_username)) !~ '[._]{2}';
$$;

REVOKE ALL ON FUNCTION public.is_valid_username_format(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_username_format(text) TO authenticated;

-- Re-define the availability probe to reject malformed input up front, so it no
-- longer reports an un-settable username as available. Membership, collision and
-- reserved-name checks are unchanged.
CREATE OR REPLACE FUNCTION public.is_customer_username_available(
  p_merchant_id uuid,
  p_username text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- Malformed values can never be set, so they are never "available".
    public.is_valid_username_format(p_username)
    -- Caller must be a customer of THIS merchant. Otherwise an unrelated
    -- authenticated user could pass an arbitrary merchant_id and probe another
    -- store's username namespace (cross-tenant enumeration). Non-customers get
    -- a uniform `false`, learning nothing about actual availability.
    AND EXISTS (
      SELECT 1
      FROM public.customers me
      WHERE me.merchant_id = p_merchant_id
        AND me.user_id = auth.uid()
        AND me.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.merchant_id = p_merchant_id
        AND pg_catalog.lower(c.username) = pg_catalog.lower(pg_catalog.btrim(p_username))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reserved_usernames r
      WHERE r.name = pg_catalog.lower(pg_catalog.btrim(p_username))
    );
$$;

REVOKE ALL ON FUNCTION public.is_customer_username_available(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_customer_username_available(uuid, text) TO authenticated;
