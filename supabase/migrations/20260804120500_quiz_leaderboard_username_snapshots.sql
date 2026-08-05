-- Freeze quiz leaderboard identity at attempt creation and make later privacy
-- suppression alter only the public projection, never rank or award evidence.

CREATE TABLE IF NOT EXISTS public.quiz_leaderboard_identity_suppressions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attempt_id uuid NOT NULL UNIQUE
    REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 3 AND 200),
  suppressed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_quiz_leaderboard_suppressions_event
  ON public.quiz_leaderboard_identity_suppressions (event_id, customer_id);

ALTER TABLE public.quiz_leaderboard_identity_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_leaderboard_identity_suppressions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.quiz_leaderboard_identity_suppressions
  TO service_role;

CREATE OR REPLACE FUNCTION private.quiz_public_leaderboard_alias(
  p_event_id uuid,
  p_customer_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 'Player-' || pg_catalog.upper(
    pg_catalog.substr(
      pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            p_event_id::text || ':' || p_customer_id::text,
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      ),
      1,
      8
    )
  );
$$;

REVOKE ALL ON FUNCTION private.quiz_public_leaderboard_alias(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.quiz_public_leaderboard_alias(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION private.suppress_quiz_leaderboard_identity(
  p_attempt_id uuid,
  p_actor_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.quiz_attempts%ROWTYPE;
  v_merchant_id uuid;
BEGIN
  IF p_actor_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'invalid_suppression_request' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.*
  INTO v_attempt
  FROM public.quiz_attempts AS attempt
  WHERE attempt.id = p_attempt_id
  FOR UPDATE;

  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT event.merchant_id
  INTO v_merchant_id
  FROM public.quiz_events AS event
  WHERE event.id = v_attempt.event_id;

  INSERT INTO public.quiz_leaderboard_identity_suppressions (
    attempt_id,
    event_id,
    customer_id,
    merchant_id,
    reason,
    suppressed_by
  ) VALUES (
    v_attempt.id,
    v_attempt.event_id,
    v_attempt.customer_id,
    v_merchant_id,
    pg_catalog.btrim(p_reason),
    p_actor_id
  )
  ON CONFLICT (attempt_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION private.suppress_quiz_leaderboard_identity(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.suppress_quiz_leaderboard_identity(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION private.keep_quiz_leaderboard_username_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.leaderboard_username IS DISTINCT FROM OLD.leaderboard_username THEN
    RAISE EXCEPTION 'quiz_leaderboard_username_immutable'
      USING ERRCODE = 'QZ051';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_leaderboard_username_immutable
  ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_leaderboard_username_immutable
  BEFORE UPDATE OF leaderboard_username ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION private.keep_quiz_leaderboard_username_immutable();

-- Username policy is enforced in both the RPC and direct-write guard so a
-- PostgREST UPDATE cannot bypass the cooldown or active-attempt restriction.
CREATE OR REPLACE FUNCTION public.validate_customer_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next_eligible_at timestamptz;
BEGIN
  IF NEW.username IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_valid_username_format(NEW.username) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reserved_usernames AS reserved
    WHERE reserved.name = pg_catalog.lower(pg_catalog.btrim(NEW.username))
  ) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  NEW.username := pg_catalog.btrim(NEW.username);
  IF TG_OP = 'UPDATE'
    AND pg_catalog.lower(NEW.username) IS NOT DISTINCT FROM
      pg_catalog.lower(OLD.username)
  THEN
    NEW.username_changed_at := OLD.username_changed_at;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL THEN
    v_next_eligible_at := OLD.username_changed_at + interval '30 days';
    IF OLD.username_changed_at IS NOT NULL
      AND clock_timestamp() < v_next_eligible_at
    THEN
      RAISE EXCEPTION 'username_change_cooldown'
        USING ERRCODE = 'QZ052',
          DETAIL = v_next_eligible_at::text;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_attempts AS attempt
    WHERE attempt.customer_id = NEW.id
      AND attempt.status = 'started'
  ) THEN
    RAISE EXCEPTION 'username_change_active_attempt' USING ERRCODE = 'QZ053';
  END IF;

  NEW.username_changed_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_customer_username ON public.customers;
CREATE TRIGGER trg_validate_customer_username
  BEFORE INSERT OR UPDATE OF username ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_customer_username();

CREATE OR REPLACE FUNCTION private.set_customer_username_v2_core(
  p_merchant_id uuid,
  p_username text
)
RETURNS TABLE (
  username text,
  username_changed_at timestamptz,
  next_eligible_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_trimmed text := pg_catalog.btrim(p_username);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_valid_username_format(p_username) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reserved_usernames AS reserved
    WHERE reserved.name = pg_catalog.lower(v_trimmed)
  ) THEN
    RAISE EXCEPTION 'reserved_username' USING ERRCODE = '22023';
  END IF;

  SELECT customer.*
  INTO v_customer
  FROM public.customers AS customer
  WHERE customer.merchant_id = p_merchant_id
    AND customer.user_id = auth.uid()
    AND customer.deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_customer.id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF pg_catalog.lower(v_customer.username) IS NOT DISTINCT FROM
    pg_catalog.lower(v_trimmed)
  THEN
    RETURN QUERY SELECT
      v_customer.username,
      v_customer.username_changed_at,
      CASE WHEN v_customer.username_changed_at IS NULL THEN NULL
        ELSE v_customer.username_changed_at + interval '30 days' END;
    RETURN;
  END IF;

  IF v_customer.username IS NOT NULL
    AND v_customer.username_changed_at IS NOT NULL
    AND clock_timestamp() < v_customer.username_changed_at + interval '30 days'
  THEN
    RAISE EXCEPTION 'username_change_cooldown'
      USING ERRCODE = 'QZ052',
        DETAIL = (v_customer.username_changed_at + interval '30 days')::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts AS attempt
    WHERE attempt.customer_id = v_customer.id
      AND attempt.status = 'started'
  ) THEN
    RAISE EXCEPTION 'username_change_active_attempt' USING ERRCODE = 'QZ053';
  END IF;

  UPDATE public.customers AS customer
  SET username = v_trimmed
  WHERE customer.id = v_customer.id
  RETURNING customer.username, customer.username_changed_at
  INTO username, username_changed_at;

  next_eligible_at := username_changed_at + interval '30 days';
  RETURN NEXT;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION private.set_customer_username_v2_core(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_customer_username_v2_core(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.set_customer_username_v2(
  p_merchant_id uuid,
  p_username text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'username', result.username,
    'usernameChangedAt', result.username_changed_at,
    'nextEligibleAt', result.next_eligible_at
  )
  FROM private.set_customer_username_v2_core(p_merchant_id, p_username) AS result;
$$;

REVOKE ALL ON FUNCTION public.set_customer_username_v2(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_username_v2(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_customer_username(
  p_merchant_id uuid,
  p_username text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT result.username
  FROM private.set_customer_username_v2_core(p_merchant_id, p_username) AS result;
$$;

REVOKE ALL ON FUNCTION public.set_customer_username(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_username(uuid, text)
  TO authenticated;

GRANT SELECT (username_changed_at) ON public.customers TO authenticated;

COMMENT ON COLUMN public.quiz_attempts.leaderboard_username IS
  'Immutable username captured when the attempt starts. Null legacy snapshots always project as an event-scoped alias.';
COMMENT ON FUNCTION public.set_customer_username_v2(uuid, text) IS
  'Authoritative merchant-scoped username write with a 30-day rename cooldown, active-quiz guard, and machine-readable eligibility timestamps.';
