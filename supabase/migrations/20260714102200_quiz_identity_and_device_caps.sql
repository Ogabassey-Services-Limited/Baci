-- Anti multi-accounting for prize quizzes: cap attempts per PERSON, not per account.
--
-- THE PROBLEM
-- Storefront signup verifies an EMAIL one-time code (auth.users.phone_confirmed_at
-- is 0 across the entire production database — nobody has a verified phone). An
-- email address is free and unlimited, so an extra account costs an attacker
-- nothing. Entry is now free and the attempt cap (QZ030) is per CUSTOMER, so one
-- person can register N accounts and take N x max_attempts runs at the prize.
-- Winners are ranked on score then speed, so more attempts is strictly better.
--
-- A short event window helps (a human cannot juggle many logins inside five
-- minutes) but does not stop a script that pre-registers accounts and fires
-- attempts in parallel.
--
-- WHAT THIS DOES — two caps that count across ACCOUNTS, not within one:
--   1. Email-identity cap (QZ040): `oga+1@gmail.com`, `oga+2@gmail.com` and
--      `o.g.a@gmail.com` all normalise to the same identity and therefore SHARE
--      one attempt budget. Kills alias farms, which are the cheapest abuse.
--   2. Device cap (QZ041): attempts from the same device share one budget, no
--      matter which account they were started from.
--
-- HONEST LIMITS. Neither closes the hole. A determined script with disposable
-- domains and a fresh device id still gets through. These raise the cost of
-- abuse; only a scarce verified identity (e.g. SMS) would bound attempts per
-- human. That is a deliberate product decision, recorded here so nobody later
-- mistakes this for airtight.
--
-- Both caps reuse the SAME per-event budget as QZ030 (quiz_events.settings
-- ->> 'max_attempts', default 3), so the cap means "3 attempts per person"
-- rather than "3 per account".
--
-- IMPLEMENTATION NOTE. The email cap is a TRIGGER, not a change to
-- start_quiz_attempt. That function is being redefined concurrently (free
-- entry), and two migrations redefining the same function would have the later
-- one silently clobber the earlier. A trigger composes with any future body.

-- The API probes this marker before calling the device-aware start RPC. The
-- marker and RPC are installed in the same migration transaction, so a
-- code-before-database deployment fails closed instead of calling a missing RPC.
CREATE OR REPLACE FUNCTION public.quiz_device_cap_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT true;
$$;

REVOKE ALL ON FUNCTION public.quiz_device_cap_ready() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_device_cap_ready() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Email normalisation. Gmail ignores dots and everything after a '+'. Only
--    providers explicitly covered below have aliases collapsed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_normalize_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_local text;
  v_domain text;
BEGIN
  v_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_email, '')));

  IF v_email = '' OR pg_catalog.position('@' IN v_email) = 0 THEN
    RETURN NULL;
  END IF;

  v_local := pg_catalog.split_part(v_email, '@', 1);
  v_domain := pg_catalog.split_part(v_email, '@', 2);

  IF v_local = '' OR v_domain = '' THEN
    RETURN NULL;
  END IF;

  -- Google treats googlemail.com as an alias of gmail.com.
  IF v_domain = 'googlemail.com' THEN
    v_domain := 'gmail.com';
  END IF;

  -- Only collapse aliases for explicitly supported providers. Treating '+' as
  -- universal can merge distinct mailboxes on domains that allow it literally.
  IF v_domain = 'gmail.com' THEN
    v_local := pg_catalog.split_part(v_local, '+', 1);
    v_local := pg_catalog.replace(v_local, '.', '');
  END IF;

  IF v_local = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_local || '@' || v_domain;
END;
$$;

COMMENT ON FUNCTION public.quiz_normalize_email(text) IS 'Collapses explicitly supported email aliases that reach the same inbox (Gmail plus tags and dots) so alias farms share one quiz attempt budget. Returns NULL for anything unusable.';

-- ---------------------------------------------------------------------------
-- 2. Per-event attempt budget, shared with QZ030 so the cap counts PEOPLE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_event_max_attempts(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    CASE
      -- Cast via numeric first: a digit-only string above int range would
      -- overflow ::integer and abort the caller. Bound it, then cast.
      WHEN e.settings->>'max_attempts' ~ '^[0-9]+$'
        AND (e.settings->>'max_attempts')::numeric BETWEEN 1 AND 2147483647
        THEN (e.settings->>'max_attempts')::integer
      ELSE 3
    END
  FROM public.quiz_events e
  WHERE e.id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Email-identity cap (QZ040). Counts every attempt at this event started by
--    ANY customer of the same merchant whose email normalises to the same
--    identity — so aliases of one inbox share a single budget.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_enforce_identity_attempt_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity text;
  v_merchant_id uuid;
  v_max_attempts integer;
  v_identity_attempts integer;
BEGIN
  SELECT public.quiz_normalize_email(c.email), c.merchant_id
  INTO v_identity, v_merchant_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  -- No usable email (e.g. a guest-checkout row): nothing to dedupe on. The
  -- per-customer cap (QZ030) and the device cap still apply.
  IF v_identity IS NULL OR v_merchant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize every alias of this identity within the event. Without this,
  -- parallel accounts can all observe the same pre-insert count.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.substr(
      pg_catalog.md5(
        NEW.event_id::text || ':' || v_merchant_id::text || ':' || v_identity
      ),
      1,
      16
    ))::bit(64)::bigint
  );

  v_max_attempts := COALESCE(public.quiz_event_max_attempts(NEW.event_id), 3);

  SELECT pg_catalog.count(*)::integer
  INTO v_identity_attempts
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.event_id = NEW.event_id
    AND c.merchant_id = v_merchant_id
    AND public.quiz_normalize_email(c.email) = v_identity;

  IF COALESCE(v_identity_attempts, 0) >= v_max_attempts THEN
    RAISE EXCEPTION 'quiz_identity_attempt_limit'
      USING ERRCODE = 'QZ040';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_attempts_enforce_identity_cap ON public.quiz_attempts;
CREATE TRIGGER quiz_attempts_enforce_identity_cap
  BEFORE INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.quiz_enforce_identity_attempt_cap();

-- ---------------------------------------------------------------------------
-- 4. Device binding. One row per attempt, so attempts from one device share a
--    budget regardless of which account started them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempt_devices (
  attempt_id uuid PRIMARY KEY REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  -- SHA-256 hex. Never store a raw device identifier: this is a stable
  -- cross-account correlator and therefore sensitive.
  device_hash text NOT NULL CHECK (device_hash ~ '^[0-9a-f]{64}$'),
  -- Persist the first cap decision so an idempotent replay cannot reclassify an
  -- earlier accepted attempt after later attempts increase the device count.
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.quiz_attempt_devices
  ADD COLUMN IF NOT EXISTS allowed boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_devices_event_hash
  ON public.quiz_attempt_devices (event_id, device_hash);

ALTER TABLE public.quiz_attempt_devices ENABLE ROW LEVEL SECURITY;

-- No policies: the device map is an abuse-control artefact. It correlates
-- accounts to one another, so no client may read it. Writes go exclusively
-- through the server-attested bind_quiz_attempt_device RPC below.
REVOKE ALL ON TABLE public.quiz_attempt_devices FROM PUBLIC, anon, authenticated;

-- Proof validation failures are retained in a generic diagnostics table. Use a
-- one-way, scope-bound digest there instead of copying the stable device hash
-- outside this locked-down map. Node derives the identical value before signing.
CREATE OR REPLACE FUNCTION public.quiz_device_proof_subject(
  p_scope_id uuid,
  p_device_hash text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT 'device:' || pg_catalog.encode(
    extensions.digest(p_scope_id::text || ':' || p_device_hash, 'sha256'),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION public.quiz_device_proof_subject(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Bind an attempt to a device and enforce the device cap (QZ041).
--    Atomic: the count and the disqualification happen in one transaction, so
--    two concurrent starts from one device cannot both slip past the cap.
-- ---------------------------------------------------------------------------
-- The function was introduced on this unmerged branch with a void return type.
-- Drop that preview-only shape so environments that applied it can converge.
DROP FUNCTION IF EXISTS public.bind_quiz_attempt_device(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.bind_quiz_attempt_device(uuid, text);
DROP FUNCTION IF EXISTS public.bind_quiz_attempt_device(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.quiz_bind_attempt_device_internal(uuid, text, uuid);

CREATE FUNCTION public.quiz_bind_attempt_device_internal(
  p_attempt_id uuid,
  p_device_hash text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_bound_device_hash text;
  v_max_attempts integer;
  v_device_attempts integer;
  v_binding_rows integer;
  v_existing_allowed boolean;
BEGIN
  IF p_device_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'quiz_device_hash_invalid' USING ERRCODE = 'QZ042';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  -- Authorization: the attempt must belong to a live customer of this user.
  -- Without this an authenticated shopper could bind (and so disqualify)
  -- somebody else's attempt.
  SELECT a.event_id
  INTO v_event_id
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.id = p_attempt_id
    AND c.user_id = p_user_id
    AND c.deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  -- Serialize concurrent starts from the SAME device on the SAME event, so the
  -- count below cannot race.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.substr(
      pg_catalog.md5(v_event_id::text || ':' || p_device_hash), 1, 16
    ))::bit(64)::bigint
  );

  INSERT INTO public.quiz_attempt_devices (attempt_id, event_id, device_hash)
  VALUES (p_attempt_id, v_event_id, p_device_hash)
  ON CONFLICT (attempt_id) DO NOTHING;
  GET DIAGNOSTICS v_binding_rows = ROW_COUNT;

  SELECT d.device_hash, d.allowed
  INTO v_bound_device_hash, v_existing_allowed
  FROM public.quiz_attempt_devices d
  WHERE d.attempt_id = p_attempt_id;

  IF v_bound_device_hash IS DISTINCT FROM p_device_hash THEN
    RAISE EXCEPTION 'quiz_device_binding_conflict' USING ERRCODE = 'QZ043';
  END IF;

  IF v_binding_rows = 0 THEN
    RETURN COALESCE(v_existing_allowed, false);
  END IF;

  v_max_attempts := COALESCE(public.quiz_event_max_attempts(v_event_id), 3);

  SELECT pg_catalog.count(*)::integer
  INTO v_device_attempts
  FROM public.quiz_attempt_devices d
  WHERE d.event_id = v_event_id
    AND d.device_hash = v_bound_device_hash;

  IF COALESCE(v_device_attempts, 0) > v_max_attempts THEN
    -- The attempt already exists (start_quiz_attempt created it), so forfeit it
    -- rather than leaving a playable over-cap attempt behind. 'disqualified' is
    -- excluded from ranking and from award minting.
    UPDATE public.quiz_attempts
    SET status = 'disqualified'
    WHERE id = p_attempt_id;

    UPDATE public.quiz_attempt_devices
    SET allowed = false
    WHERE attempt_id = p_attempt_id;

    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.quiz_bind_attempt_device_internal(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.bind_quiz_attempt_device(
  p_attempt_id uuid,
  p_device_hash text,
  p_route_proof jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  IF NOT public.quiz_route_proof_valid(
    p_route_proof,
    'bind_quiz_attempt_device_v1',
    public.quiz_device_proof_subject(p_attempt_id, p_device_hash),
    v_user_id
  ) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  RETURN public.quiz_bind_attempt_device_internal(
    p_attempt_id,
    p_device_hash,
    v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bind_quiz_attempt_device(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_quiz_attempt_device(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.bind_quiz_attempt_device(uuid, text, jsonb) IS 'Binds a quiz attempt to a server-attested hashed device id and enforces the per-device attempt cap (QZ041), disqualifying the over-cap attempt. Attempts from one device share a budget regardless of which account started them.';

-- Start and bind in one database transaction. The attempt and its questions do
-- not become visible through RLS until the device-cap decision has committed,
-- closing the race where an answer could overwrite a concurrent disqualification.
DROP FUNCTION IF EXISTS public.start_quiz_attempt_with_device(uuid, text, text, jsonb, jsonb, uuid);

CREATE FUNCTION public.start_quiz_attempt_with_device(
  p_event_id uuid,
  p_integrity_tier text,
  p_device_hash text,
  p_start_route_proof jsonb,
  p_device_route_proof jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_data jsonb;
  v_attempt_id uuid;
  v_auth_user_id uuid;
  v_device_allowed boolean := true;
  v_device_binding_failed boolean := false;
BEGIN
  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL OR v_auth_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  -- Bind the device parameter to a separate server proof before creating the
  -- attempt. Authenticated clients cannot choose another hash while replaying a
  -- proof intended for this event and device.
  IF NOT public.quiz_route_proof_valid(
    p_device_route_proof,
    'start_quiz_attempt_with_device_v1',
    public.quiz_device_proof_subject(p_event_id, p_device_hash),
    p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  v_start_data := public.start_quiz_attempt(
    p_event_id,
    p_integrity_tier,
    p_start_route_proof,
    p_user_id
  );
  v_attempt_id := NULLIF(v_start_data->>'attemptId', '')::uuid;

  -- A binding infrastructure fault must not block a legitimate player. The
  -- exception block is a subtransaction: partial binding changes roll back,
  -- while the successfully created attempt remains available and is bounded by
  -- the per-customer and normalized-email caps.
  BEGIN
    v_device_allowed := public.quiz_bind_attempt_device_internal(
      v_attempt_id,
      p_device_hash,
      p_user_id
    );
  EXCEPTION
    WHEN SQLSTATE '55P03' -- lock_not_available
      OR SQLSTATE '57014' -- query_canceled / statement timeout
      OR SQLSTATE '40001' -- serialization_failure
      OR SQLSTATE '40P01' -- deadlock_detected
    THEN
    v_device_allowed := true;
    v_device_binding_failed := true;
  END;

  RETURN v_start_data || pg_catalog.jsonb_build_object(
    'deviceAllowed', v_device_allowed,
    'deviceBindingFailed', v_device_binding_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_quiz_attempt_with_device(uuid, text, text, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt_with_device(uuid, text, text, jsonb, jsonb, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.start_quiz_attempt_with_device(uuid, text, text, jsonb, jsonb, uuid) IS 'Atomically starts a free quiz attempt and enforces the cross-account device cap before the attempt becomes visible. Binding infrastructure errors fail soft and are surfaced to the server for logging.';
