-- Follow-up to 20260707100000_customer_usernames.sql and
-- 20260707110000_customer_username_availability_format.sql.
--
-- Two hardening fixes, both on the direct-write / advisory-probe surface:
--
--   1. Reject direct username CLEARS. The write guard trigger only fired
--      `WHEN (NEW.username IS NOT NULL)`, so a shopper could bypass it with a
--      direct PostgREST `UPDATE customers SET username = NULL` and drop the
--      required leaderboard display name after passing the quiz gate. The set
--      RPC never clears (it always writes a validated non-null value), so a NULL
--      username on UPDATE can only be a direct-write clear. Fire the trigger on
--      every username write and reject clearing an existing username. INSERT
--      with NULL (a new customer that has not chosen a username yet) stays
--      allowed.
--
--   2. Treat the caller's OWN username as available. The advisory probe's
--      collision check matched the caller's own row, so re-checking your current
--      username reported "taken" even though set_customer_username would happily
--      re-set a row to its own value. Exclude the caller's own row.

-- ---------------------------------------------------------------------------
-- 1. Write guard: reject NULL clears of an existing username.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_customer_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_norm text;
BEGIN
  -- A NULL username on UPDATE that had a prior value is a direct-write clear:
  -- the set RPC never produces one. Block it so the leaderboard display name
  -- cannot be dropped outside the RPC. INSERT-with-NULL and NULL->NULL no-ops
  -- stay allowed (a brand-new customer has no username yet).
  IF NEW.username IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  v_norm := pg_catalog.lower(pg_catalog.btrim(NEW.username));

  IF v_norm !~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' OR v_norm ~ '[._]{2}' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_usernames r WHERE r.name = v_norm) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  -- Normalize the stored value's surrounding whitespace so the index and reads
  -- stay consistent regardless of write path.
  NEW.username := pg_catalog.btrim(NEW.username);
  RETURN NEW;
END;
$$;

-- Recreate the trigger WITHOUT the `WHEN (NEW.username IS NOT NULL)` clause so
-- it also fires on NULL writes and can reject clears. It still only fires when
-- the username column is targeted (`UPDATE OF username`), so unrelated customer
-- updates are unaffected.
DROP TRIGGER IF EXISTS trg_validate_customer_username ON public.customers;
CREATE TRIGGER trg_validate_customer_username
  BEFORE INSERT OR UPDATE OF username ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_customer_username();

-- ---------------------------------------------------------------------------
-- 2. Availability probe: exclude the caller's own row from the collision check.
-- ---------------------------------------------------------------------------
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
        -- Exclude the caller's own row: re-checking your CURRENT username must
        -- report "available" (set_customer_username can re-set a row to its own
        -- value), otherwise a future edit UI would tell the owner it is taken.
        AND c.user_id IS DISTINCT FROM auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reserved_usernames r
      WHERE r.name = pg_catalog.lower(pg_catalog.btrim(p_username))
    );
$$;

REVOKE ALL ON FUNCTION public.is_customer_username_available(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_customer_username_available(uuid, text) TO authenticated;
