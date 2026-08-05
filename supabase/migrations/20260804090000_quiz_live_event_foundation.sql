-- Quiz v2 foundation: isolate private test events, snapshot player acceptance,
-- and close legacy direct-read paths before the v2 player RPCs are exposed.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.quiz_events
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS contract_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS results_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS rules_version text;

ALTER TABLE public.quiz_events
  DROP CONSTRAINT IF EXISTS quiz_events_mode_check;
ALTER TABLE public.quiz_events
  ADD CONSTRAINT quiz_events_mode_check CHECK (mode IN ('test', 'live'));
ALTER TABLE public.quiz_events
  DROP CONSTRAINT IF EXISTS quiz_events_contract_version_check;
ALTER TABLE public.quiz_events
  ADD CONSTRAINT quiz_events_contract_version_check
  CHECK (contract_version IN (1, 2));

COMMENT ON COLUMN public.quiz_events.contract_version IS
  'Legacy rows default to contract 1. Every new v2 authoring RPC must explicitly persist 2.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_events_id_merchant_unique
  ON public.quiz_events (id, merchant_id);

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS leaderboard_username text,
  ADD COLUMN IF NOT EXISTS rules_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS start_request_id uuid;

ALTER TABLE public.quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_status_check CHECK (
    status IN (
      'started',
      'submitted',
      'scored',
      'disqualified',
      'expired',
      'test_reset',
      'tester_revoked',
      'event_cancelled'
    )
  );
ALTER TABLE public.quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_platform_check;
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_platform_check
  CHECK (platform IS NULL OR platform IN ('android', 'ios', 'web'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_start_request_unique
  ON public.quiz_attempts (event_id, customer_id, start_request_id)
  WHERE start_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_one_started_per_customer
  ON public.quiz_attempts (event_id, customer_id)
  WHERE status = 'started';

ALTER TABLE public.quiz_attempt_questions
  ADD COLUMN IF NOT EXISTS option_order jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.quiz_attempt_questions
  DROP CONSTRAINT IF EXISTS quiz_attempt_questions_option_order_array;
ALTER TABLE public.quiz_attempt_questions
  ADD CONSTRAINT quiz_attempt_questions_option_order_array
  CHECK (jsonb_typeof(option_order) = 'array');

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.quiz_event_testers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT quiz_event_testers_event_merchant_fkey
    FOREIGN KEY (event_id, merchant_id)
    REFERENCES public.quiz_events(id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT quiz_event_testers_event_user_unique UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_test_invites (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT quiz_test_invites_event_merchant_fkey
    FOREIGN KEY (event_id, merchant_id)
    REFERENCES public.quiz_events(id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT quiz_test_invites_bounded_expiry CHECK (
    expires_at > created_at
    AND expires_at <= created_at + interval '30 minutes'
  ),
  CONSTRAINT quiz_test_invites_use_pair CHECK (
    (used_at IS NULL AND used_by IS NULL)
    OR (used_at IS NOT NULL AND used_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_quiz_event_testers_user_event
  ON public.quiz_event_testers (user_id, event_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_event_testers_merchant
  ON public.quiz_event_testers (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_test_invites_event_active
  ON public.quiz_test_invites (event_id, expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.quiz_event_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_test_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quiz_event_testers, public.quiz_test_invites
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.quiz_event_testers, public.quiz_test_invites TO service_role;

-- Compliance fields are never a player projection. Merchant launch/review uses
-- narrow security-definer RPCs in the authoring wave.
REVOKE SELECT (nlrc_permit_ref, compliance_verified)
  ON public.quiz_events FROM authenticated;

-- Replace every permissive quiz read policy. Contract-v1 archives retain their
-- bounded compatibility path; v2 rows are read through safe projection RPCs.
DROP POLICY IF EXISTS quiz_events_client_read ON public.quiz_events;
DROP POLICY IF EXISTS quiz_events_merchant_author_read ON public.quiz_events;
DROP POLICY IF EXISTS quiz_events_authenticated_select ON public.quiz_events;
CREATE POLICY quiz_events_authenticated_select
  ON public.quiz_events FOR SELECT TO authenticated
  USING (
    public.has_merchant_access(merchant_id)
    OR (
      contract_version = 1
      AND status IN ('scheduled', 'active', 'completed')
      AND EXISTS (
        SELECT 1 FROM public.customers AS c
        WHERE c.merchant_id = quiz_events.merchant_id
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS quiz_slots_client_read ON public.quiz_question_slots;
DROP POLICY IF EXISTS quiz_slots_merchant_author_read ON public.quiz_question_slots;
DROP POLICY IF EXISTS quiz_slots_authenticated_select ON public.quiz_question_slots;
CREATE POLICY quiz_slots_authenticated_select
  ON public.quiz_question_slots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND (
          public.has_merchant_access(e.merchant_id)
          OR (
            e.contract_version = 1
            AND quiz_question_slots.active
            AND e.status IN ('scheduled', 'active', 'completed')
            AND EXISTS (
              SELECT 1 FROM public.customers AS c
              WHERE c.merchant_id = e.merchant_id
                AND c.user_id = (SELECT auth.uid())
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS quiz_variants_client_read ON public.quiz_question_variants;
DROP POLICY IF EXISTS quiz_variants_merchant_author_read ON public.quiz_question_variants;
DROP POLICY IF EXISTS quiz_variants_authenticated_select ON public.quiz_question_variants;
CREATE POLICY quiz_variants_authenticated_select
  ON public.quiz_question_variants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
    OR (
      quiz_question_variants.active
      AND EXISTS (
        SELECT 1
        FROM public.quiz_attempt_questions AS aq
        JOIN public.quiz_attempts AS a ON a.id = aq.attempt_id
        JOIN public.quiz_events AS e ON e.id = a.event_id
        JOIN public.customers AS c ON c.id = a.customer_id
        WHERE aq.variant_id = quiz_question_variants.id
          AND e.contract_version = 1
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS quiz_attempts_customer_read ON public.quiz_attempts;
CREATE POLICY quiz_attempts_customer_read
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers AS c
      JOIN public.quiz_events AS e ON e.id = quiz_attempts.event_id
      WHERE c.id = quiz_attempts.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS quiz_attempt_questions_customer_read
  ON public.quiz_attempt_questions;
CREATE POLICY quiz_attempt_questions_customer_read
  ON public.quiz_attempt_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempts AS a
      JOIN public.quiz_events AS e ON e.id = a.event_id
      JOIN public.customers AS c ON c.id = a.customer_id
      WHERE a.id = quiz_attempt_questions.attempt_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS quiz_attempt_answers_customer_read
  ON public.quiz_attempt_answers;
CREATE POLICY quiz_attempt_answers_customer_read
  ON public.quiz_attempt_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempt_questions AS aq
      JOIN public.quiz_attempts AS a ON a.id = aq.attempt_id
      JOIN public.quiz_events AS e ON e.id = a.event_id
      JOIN public.customers AS c ON c.id = a.customer_id
      WHERE aq.id = quiz_attempt_answers.attempt_question_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS quiz_awards_customer_read ON public.quiz_awards;
CREATE POLICY quiz_awards_customer_read
  ON public.quiz_awards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers AS c
      JOIN public.quiz_events AS e ON e.id = quiz_awards.event_id
      WHERE c.id = quiz_awards.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS quiz_signal_flags_customer_read
  ON public.quiz_attempt_signal_flags;
CREATE POLICY quiz_signal_flags_customer_read
  ON public.quiz_attempt_signal_flags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempts AS a
      JOIN public.quiz_events AS e ON e.id = a.event_id
      JOIN public.customers AS c ON c.id = a.customer_id
      WHERE a.id = quiz_attempt_signal_flags.attempt_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS quiz_integrity_challenges_customer_read
  ON public.quiz_integrity_challenges;
CREATE POLICY quiz_integrity_challenges_customer_read
  ON public.quiz_integrity_challenges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempts AS a
      JOIN public.quiz_events AS e ON e.id = a.event_id
      JOIN public.customers AS c ON c.id = a.customer_id
      WHERE a.id = quiz_integrity_challenges.attempt_id
        AND c.user_id = (SELECT auth.uid())
        AND e.contract_version = 1
    )
  );

DROP POLICY IF EXISTS leaderboard_refresh_log_client_read
  ON public.leaderboard_refresh_log;
CREATE POLICY leaderboard_refresh_log_client_read
  ON public.leaderboard_refresh_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      JOIN public.customers AS c ON c.merchant_id = e.merchant_id
      WHERE e.id = leaderboard_refresh_log.event_id
        AND e.contract_version = 1
        AND e.status = 'completed'
        AND c.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.redeem_quiz_test_invite_v2(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_invite public.quiz_test_invites%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'quiz_auth_required' USING ERRCODE = 'QZ401';
  END IF;
  IF p_token IS NULL OR pg_catalog.length(pg_catalog.btrim(p_token)) < 32 THEN
    RAISE EXCEPTION 'quiz_invite_invalid' USING ERRCODE = 'QZ400';
  END IF;

  SELECT invite.*
  INTO v_invite
  FROM public.quiz_test_invites AS invite
  JOIN public.quiz_events AS event ON event.id = invite.event_id
  WHERE invite.token_digest = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'),
      'hex'
    )
    AND invite.used_at IS NULL
    AND invite.revoked_at IS NULL
    AND invite.expires_at > pg_catalog.clock_timestamp()
    AND event.mode = 'test'
    AND event.contract_version = 2
    AND event.status IN ('scheduled', 'active')
    AND event.ends_at > pg_catalog.clock_timestamp()
  FOR UPDATE OF invite;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_invite_unavailable' USING ERRCODE = 'QZ404';
  END IF;

  INSERT INTO public.quiz_event_testers (
    event_id,
    merchant_id,
    user_id,
    invited_by
  ) VALUES (
    v_invite.event_id,
    v_invite.merchant_id,
    v_caller,
    v_invite.created_by
  )
  ON CONFLICT (event_id, user_id) DO UPDATE
  SET revoked_at = NULL,
      revoked_by = NULL;

  UPDATE public.quiz_test_invites
  SET used_at = pg_catalog.clock_timestamp(),
      used_by = v_caller
  WHERE id = v_invite.id;

  RETURN v_invite.event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_quiz_test_invite_v2(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_quiz_test_invite_v2(text)
  TO authenticated;

COMMENT ON FUNCTION public.redeem_quiz_test_invite_v2(text) IS
  'Consumes one hashed 30-minute test invite for auth.uid(); raw tokens are never stored.';
