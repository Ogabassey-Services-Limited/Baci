-- Customer usernames (Phase A foundation for the public quiz leaderboard +
-- future shopper referral codes).
--
-- Idiom (2026 Postgres best practice): a plain `text` column storing the
-- customer's chosen casing, with a CASE-INSENSITIVE uniqueness enforced by a
-- functional unique index on (merchant_id, lower(username)) — NOT citext (a
-- plain UNIQUE on citext is still case-sensitive unless indexed explicitly, and
-- Postgres now steers away from citext). Usernames are per-merchant because
-- customers are already merchant-scoped and multi-tenant.

-- ---------------------------------------------------------------------------
-- Reserved / blocked usernames (impersonation + profanity). Server-only: read
-- exclusively inside the SECURITY DEFINER RPC below; clients get no access.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserved_usernames (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all for anon/authenticated. The DEFINER function (owner)
-- bypasses RLS to read it.
REVOKE ALL ON public.reserved_usernames FROM anon, authenticated;

INSERT INTO public.reserved_usernames (name)
VALUES
  ('admin'), ('administrator'), ('root'), ('support'), ('help'),
  ('moderator'), ('mod'), ('staff'), ('official'), ('system'), ('null'),
  ('undefined'), ('anonymous'), ('guest'), ('baci'), ('ogabassey'),
  ('security'), ('billing'), ('payments'), ('team'), ('owner'), ('me')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Column + case-insensitive per-merchant unique index
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_merchant_username_ci
  ON public.customers (merchant_id, lower(username))
  WHERE username IS NOT NULL;

-- The customer reads their own username via the existing customers RLS SELECT.
-- Grant the new column explicitly in case the table uses column-scoped grants.
GRANT SELECT (username) ON public.customers TO authenticated;

-- ---------------------------------------------------------------------------
-- Validation + set RPC. Charset/length are enforced here; the unique index is
-- the authoritative collision guard. Confusable/homoglyph folding (NFKC +
-- skeleton) is done in the API layer BEFORE calling this, since Postgres can't
-- portably fold Unicode confusables.
-- ---------------------------------------------------------------------------
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

  -- Reject NULL/blank up front. A NULL p_username makes v_norm NULL, and the
  -- regex/length predicates below evaluate to NULL (not TRUE), so without this
  -- guard the UPDATE would silently CLEAR an existing username — letting a
  -- caller drop their required leaderboard display name after the UI gate.
  IF v_norm IS NULL OR v_norm = '' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  -- 3-20 chars; a-z 0-9 plus single . or _ separators; must start and end
  -- alphanumeric; no consecutive separators. The {1,18} quantifier already
  -- bounds the value to 3-20 chars, so no separate length check is needed.
  IF v_norm !~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' OR v_norm ~ '[._]{2}' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_usernames r WHERE r.name = v_norm) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  -- Resolve the caller's customer row for THIS merchant.
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.merchant_id = p_merchant_id
    AND c.user_id = v_user_id
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Store the customer's chosen casing; uniqueness is enforced on lower().
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

-- ---------------------------------------------------------------------------
-- Column-level write guard. `public.customers` has table-level GRANT ALL to
-- `authenticated` and an UPDATE RLS policy scoped to the caller's own row, so a
-- shopper could write `username` DIRECTLY via PostgREST and bypass the RPC's
-- charset/reserved validation (e.g. store `admin` or a value with spaces). This
-- BEFORE trigger re-applies the same format + reserved rules on EVERY write
-- path (direct table writes and the RPC alike). Uniqueness is still enforced by
-- the case-insensitive partial index above. NULL is allowed (clearing/omitting
-- a username is not an impersonation risk).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_customer_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_norm text := pg_catalog.lower(pg_catalog.btrim(NEW.username));
BEGIN
  IF v_norm !~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' OR v_norm ~ '[._]{2}' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_usernames r WHERE r.name = v_norm) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  -- Normalize the stored value's surrounding whitespace so the index and
  -- reads stay consistent regardless of write path.
  NEW.username := pg_catalog.btrim(NEW.username);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_customer_username ON public.customers;
CREATE TRIGGER trg_validate_customer_username
  BEFORE INSERT OR UPDATE OF username ON public.customers
  FOR EACH ROW
  WHEN (NEW.username IS NOT NULL)
  EXECUTE FUNCTION public.validate_customer_username();

-- Availability probe for the UI (advisory only; the unique index is the real
-- guard against a race between check and set).
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
    -- Caller must be a customer of THIS merchant. Otherwise an unrelated
    -- authenticated user could pass an arbitrary merchant_id and probe another
    -- store's username namespace (cross-tenant enumeration). Non-customers get
    -- a uniform `false`, learning nothing about actual availability.
    EXISTS (
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
