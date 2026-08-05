-- Player-facing quiz v2 projections. These functions return bounded JSON and
-- intentionally exclude compliance evidence, answer correctness, and PII.

CREATE OR REPLACE FUNCTION public.quiz_runtime_contract_version()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT 1 $$;

REVOKE ALL ON FUNCTION public.quiz_runtime_contract_version()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_runtime_contract_version()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_quiz_events_v2(
  p_merchant_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_events jsonb;
  v_returned integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 50 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers AS customer
    WHERE customer.merchant_id = p_merchant_id
      AND customer.user_id = auth.uid()
      AND customer.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;

  WITH visible AS (
    SELECT event.*
    FROM public.quiz_events AS event
    WHERE event.merchant_id = p_merchant_id
      AND event.contract_version = 2
      AND event.status IN ('scheduled', 'active', 'completed')
      AND event.starts_at IS NOT NULL
      AND event.ends_at IS NOT NULL
      AND event.ends_at > event.starts_at
      AND event.question_count BETWEEN 1 AND 50
      AND event.time_per_question_seconds BETWEEN 5 AND 60
      AND event.maximum_play_seconds =
        event.question_count * event.time_per_question_seconds
      AND event.live_window_seconds =
        EXTRACT(EPOCH FROM (event.ends_at - event.starts_at))::integer
      AND event.max_attempts BETWEEN 1 AND 50
      AND (event.mode <> 'live' OR event.max_attempts = 1)
      AND pg_catalog.length(pg_catalog.btrim(event.time_zone)) > 0
      AND event.rules_version IS NOT NULL
      AND event.settings->>'prize_product_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND pg_catalog.length(pg_catalog.btrim(event.settings->>'prize_product_name')) > 0
      AND pg_catalog.length(pg_catalog.btrim(event.settings->>'prize_name')) > 0
      AND COALESCE(event.settings->>'prize_product_condition', '') IN (
        '', 'new', 'used', 'open_box', 'refurbished'
      )
      AND (
        NULLIF(event.settings->>'prize_variant_id', '') IS NULL
        OR event.settings->>'prize_variant_id' ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
      AND (
        (
          event.mode = 'test'
          AND (
            EXISTS (
              SELECT 1 FROM public.quiz_event_testers AS tester
              WHERE tester.event_id = event.id
                AND tester.user_id = auth.uid()
                AND tester.revoked_at IS NULL
            )
            OR public.has_merchant_access(event.merchant_id)
          )
        )
        OR (
          event.mode = 'live'
          AND event.compliance_verified
          AND pg_catalog.length(pg_catalog.btrim(event.nlrc_permit_ref)) > 0
        )
      )
    ORDER BY event.starts_at DESC, event.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'contractVersion', 2,
          'endsAt', visible.ends_at,
          'id', visible.id,
          'liveWindowSeconds', visible.live_window_seconds,
          'maxAttempts', visible.max_attempts,
          'maximumPlaySeconds', visible.maximum_play_seconds,
          'mode', visible.mode,
          'prizeName', visible.settings->>'prize_name',
          'prizeProduct', pg_catalog.jsonb_build_object(
            'condition', NULLIF(visible.settings->>'prize_product_condition', ''),
            'id', visible.settings->>'prize_product_id',
            'imageUrl', NULLIF(visible.settings->>'prize_product_image_url', ''),
            'name', visible.settings->>'prize_product_name',
            'variantId', NULLIF(visible.settings->>'prize_variant_id', '')
          ),
          'questionCount', visible.question_count,
          'resultsPublishedAt', visible.results_published_at,
          'rulesVersion', visible.rules_version,
          'startsAt', visible.starts_at,
          'status', CASE
            WHEN visible.ends_at <= v_now
              AND visible.results_published_at IS NULL THEN 'finalizing'
            ELSE visible.status
          END,
          'timePerQuestionSeconds', visible.time_per_question_seconds,
          'timeZone', visible.time_zone,
          'title', visible.title
        )
        ORDER BY visible.starts_at DESC, visible.id
      ),
      '[]'::jsonb
    ),
    pg_catalog.count(*)::integer
  INTO v_events, v_returned
  FROM visible;

  RETURN pg_catalog.jsonb_build_object(
    'contractVersion', 2,
    'entryMode', 'free',
    'events', v_events,
    'pagination', pg_catalog.jsonb_build_object(
      'hasMore', v_returned = p_limit,
      'limit', p_limit,
      'nextOffset', CASE WHEN v_returned = p_limit
        THEN p_offset + p_limit ELSE NULL END,
      'offset', p_offset
    ),
    'serverNow', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_quiz_events_v2(uuid, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_quiz_events_v2(uuid, integer, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard_public_v2(
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.quiz_events%ROWTYPE;
  v_customer_id uuid;
  v_entries jsonb;
  v_current_player jsonb;
BEGIN
  SELECT event.* INTO v_event
  FROM public.quiz_events AS event
  WHERE event.id = p_event_id;

  IF v_event.id IS NULL OR v_event.contract_version <> 2 THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'unavailable', 'entries', '[]'::jsonb, 'current_player', NULL
    );
  END IF;

  SELECT customer.id INTO v_customer_id
  FROM public.customers AS customer
  WHERE customer.merchant_id = v_event.merchant_id
    AND customer.user_id = auth.uid()
    AND customer.deleted_at IS NULL
  LIMIT 1;
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;

  IF v_event.mode = 'test' AND NOT (
    public.has_merchant_access(v_event.merchant_id)
    OR EXISTS (
      SELECT 1 FROM public.quiz_event_testers AS tester
      WHERE tester.event_id = v_event.id
        AND tester.user_id = auth.uid()
        AND tester.revoked_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;
  IF v_event.mode = 'live' AND (
    v_event.compliance_verified IS NOT TRUE
    OR NULLIF(pg_catalog.btrim(v_event.nlrc_permit_ref), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;

  IF v_event.status = 'cancelled' THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'unavailable', 'entries', '[]'::jsonb, 'current_player', NULL
    );
  END IF;
  IF v_event.results_published_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'live_hidden', 'entries', '[]'::jsonb, 'current_player', NULL
    );
  END IF;

  WITH ranked AS (
    SELECT
      candidate.rank,
      attempt.*,
      candidate.total_time_seconds,
      customer.user_id,
      customer.deleted_at,
      suppression.id AS suppression_id
    FROM private.quiz_ranked_candidates_v2(v_event.id) AS candidate
    JOIN public.quiz_attempts AS attempt ON attempt.id = candidate.attempt_id
    LEFT JOIN public.customers AS customer ON customer.id = attempt.customer_id
    LEFT JOIN public.quiz_leaderboard_identity_suppressions AS suppression
      ON suppression.attempt_id = attempt.id
  ), projected AS (
    SELECT
      ranked.rank,
      pg_catalog.jsonb_build_object(
        'customer_name', CASE
          WHEN ranked.deleted_at IS NOT NULL
            OR ranked.suppression_id IS NOT NULL
            OR NULLIF(pg_catalog.btrim(ranked.leaderboard_username), '') IS NULL
          THEN private.quiz_public_leaderboard_alias(v_event.id, ranked.customer_id)
          ELSE pg_catalog.btrim(ranked.leaderboard_username)
        END,
        'is_current_customer', ranked.customer_id = v_customer_id,
        'rank', ranked.rank,
        'score', ranked.score,
        'status', ranked.status,
        'submitted_at', ranked.submitted_at,
        'total_time_seconds', ranked.total_time_seconds
      ) AS entry,
      ranked.customer_id
    FROM ranked
  )
  SELECT
    COALESCE(
      pg_catalog.jsonb_agg(projected.entry ORDER BY projected.rank)
        FILTER (WHERE projected.rank <= 100),
      '[]'::jsonb
    ),
    (pg_catalog.jsonb_agg(projected.entry ORDER BY projected.rank)
      FILTER (
        WHERE projected.customer_id = v_customer_id
          AND projected.rank > 100
      ))->0
  INTO v_entries, v_current_player
  FROM projected;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'published',
    'entries', v_entries,
    'current_player', v_current_player
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard_public_v2(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard_public_v2(uuid)
  TO authenticated, service_role;

-- Legacy archives retain their response shape, but active/unpublished events
-- return no rows and all null/suppressed/deleted identities use the same alias.
DROP FUNCTION IF EXISTS public.get_quiz_leaderboard_public(uuid);
DROP FUNCTION IF EXISTS public.get_quiz_leaderboard(uuid);

CREATE FUNCTION public.get_quiz_leaderboard(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  attempt_id uuid,
  customer_id uuid,
  customer_name text,
  score integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text,
  is_current_customer boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH authorized_event AS (
    SELECT event.*
    FROM public.quiz_events AS event
    WHERE event.id = p_event_id
      AND (
        (event.contract_version = 2 AND event.results_published_at IS NOT NULL)
        OR (event.contract_version = 1 AND event.status = 'completed')
      )
      AND EXISTS (
        SELECT 1 FROM public.customers AS viewer
        WHERE viewer.merchant_id = event.merchant_id
          AND viewer.user_id = auth.uid()
          AND viewer.deleted_at IS NULL
      )
  ), best_attempts AS (
    SELECT DISTINCT ON (attempt.customer_id) attempt.*
    FROM public.quiz_attempts AS attempt
    JOIN authorized_event AS event ON event.id = attempt.event_id
    WHERE attempt.status IN ('submitted', 'scored')
      AND attempt.submitted_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.quiz_attempt_signal_flags AS flag
        WHERE flag.attempt_id = attempt.id AND flag.severity = 'block'
      )
    ORDER BY attempt.customer_id, attempt.score DESC NULLS LAST,
      EXTRACT(EPOCH FROM (attempt.submitted_at - attempt.started_at)) ASC NULLS LAST,
      attempt.submitted_at, attempt.id
  ), ranked AS (
    SELECT
      pg_catalog.row_number() OVER (
        ORDER BY attempt.score DESC NULLS LAST,
          EXTRACT(EPOCH FROM (attempt.submitted_at - attempt.started_at)) ASC NULLS LAST,
          attempt.submitted_at, attempt.id
      ) AS rank,
      attempt.*,
      customer.user_id,
      customer.deleted_at,
      suppression.id AS suppression_id
    FROM best_attempts AS attempt
    LEFT JOIN public.customers AS customer ON customer.id = attempt.customer_id
    LEFT JOIN public.quiz_leaderboard_identity_suppressions AS suppression
      ON suppression.attempt_id = attempt.id
  )
  SELECT
    ranked.rank,
    ranked.id,
    ranked.customer_id,
    CASE
      WHEN ranked.deleted_at IS NOT NULL
        OR ranked.suppression_id IS NOT NULL
        OR NULLIF(pg_catalog.btrim(ranked.leaderboard_username), '') IS NULL
      THEN private.quiz_public_leaderboard_alias(p_event_id, ranked.customer_id)
      ELSE pg_catalog.btrim(ranked.leaderboard_username)
    END,
    ranked.score,
    EXTRACT(EPOCH FROM (ranked.submitted_at - ranked.started_at))::double precision,
    ranked.submitted_at,
    ranked.status,
    ranked.user_id = auth.uid()
  FROM ranked
  ORDER BY ranked.rank
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO service_role;

CREATE FUNCTION public.get_quiz_leaderboard_public(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  customer_name text,
  score integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text,
  is_current_customer boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT board.rank, board.customer_name, board.score,
    board.total_time_seconds, board.submitted_at, board.status,
    board.is_current_customer
  FROM public.get_quiz_leaderboard(p_event_id) AS board
  ORDER BY board.rank;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard_public(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard_public(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.quiz_runtime_contract_version() IS
  'Deployment sentinel intentionally returns 1 until the direct player projection lockdown upgrades it.';
COMMENT ON FUNCTION public.get_quiz_leaderboard_public_v2(uuid) IS
  'Privacy-safe published top 100 plus the authenticated player rank when outside the top 100.';
