-- DRY the username charset/format rule onto a single predicate.
--
-- 20260707100000 inline-duplicated the "3-20 chars, a-z0-9 plus single . _
-- separators, start/end alphanumeric, no consecutive separators" regex in BOTH
-- set_customer_username and the validate_customer_username write-guard trigger.
-- 20260707110000 added public.is_valid_username_format() as the single source of
-- truth (used by the availability probe). Recreate the setter + trigger to call
-- that predicate instead, so the rule lives in exactly one place. Behavior is
-- IDENTICAL: is_valid_username_format returns FALSE for NULL/blank and for any
-- value failing the same regex, so `NOT is_valid_username_format(...)` covers the
-- prior explicit NULL/blank guard AND the inline regex check.

CREATE OR REPLACE FUNCTION public.set_customer_username(
  p_merchant_id uuid,
  p_username text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_trimmed text := pg_catalog.btrim(p_username);
  v_norm text := pg_catalog.lower(pg_catalog.btrim(p_username));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Single source of truth for NULL/blank + charset/length. Returning FALSE for
  -- NULL prevents the setter from silently clearing an existing username.
  IF NOT public.is_valid_username_format(p_username) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_usernames r WHERE r.name = v_norm) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.merchant_id = p_merchant_id
    AND c.user_id = v_user_id
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.customers
     SET username = v_trimmed
   WHERE id = v_customer_id;

  RETURN v_trimmed;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_username(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_username(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_customer_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_norm text;
BEGIN
  -- NULL semantics reproduced VERBATIM from 20260707120000 (the trigger has no
  -- WHEN clause, so it fires on every INSERT/UPDATE OF username):
  --   * INSERT with NULL           -> allowed (new customers have no handle yet;
  --                                   raising here would break customer creation)
  --   * UPDATE NULL -> NULL        -> allowed (no-op)
  --   * UPDATE non-NULL -> NULL    -> BLOCKED (a direct-write clear; the set RPC
  --                                   never produces one, and clearing would drop
  --                                   the leaderboard display name outside the RPC)
  IF NEW.username IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  v_norm := pg_catalog.lower(pg_catalog.btrim(NEW.username));

  -- Only the format rule is DRY'd onto the shared predicate; everything else
  -- matches 20260707120000.
  IF NOT public.is_valid_username_format(NEW.username) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_usernames r WHERE r.name = v_norm) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  NEW.username := pg_catalog.btrim(NEW.username);
  RETURN NEW;
END;
$$;
