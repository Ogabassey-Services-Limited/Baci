-- Quiz v2 live prizes are jurisdiction-aware free-entry skill competitions,
-- not universally NLRC-permitted lotteries. Legacy NLRC columns remain for
-- historical records, but v2 player/runtime gates use these bounded fields.

ALTER TABLE public.quiz_events
  ADD COLUMN IF NOT EXISTS regulatory_basis text,
  ADD COLUMN IF NOT EXISTS regulatory_jurisdiction text,
  ADD COLUMN IF NOT EXISTS regulatory_evidence_ref text;

ALTER TABLE public.quiz_events
  DROP CONSTRAINT IF EXISTS quiz_events_regulatory_basis_check;
ALTER TABLE public.quiz_events
  ADD CONSTRAINT quiz_events_regulatory_basis_check CHECK (
    (
      regulatory_basis IS NULL
      AND regulatory_jurisdiction IS NULL
      AND regulatory_evidence_ref IS NULL
    )
    OR (
      regulatory_basis IN (
        'free_skill_competition',
        'state_permit',
        'fccpc_registration'
      )
      AND pg_catalog.length(pg_catalog.btrim(regulatory_jurisdiction)) BETWEEN 2 AND 100
      AND pg_catalog.length(pg_catalog.btrim(regulatory_evidence_ref)) BETWEEN 3 AND 240
    )
  );

-- Do not make deployment depend on historical live rows. NOT VALID still
-- enforces this for all new/changed v2 live events; existing rows must be
-- reviewed and migrated before they can be relaunched or finalized.
ALTER TABLE public.quiz_events
  DROP CONSTRAINT IF EXISTS quiz_events_v2_live_regulatory_readiness_check;
ALTER TABLE public.quiz_events
  ADD CONSTRAINT quiz_events_v2_live_regulatory_readiness_check CHECK (
    contract_version <> 2
    OR mode <> 'live'
    OR (
      compliance_verified IS TRUE
      AND regulatory_basis IN (
        'free_skill_competition',
        'state_permit',
        'fccpc_registration'
      )
      AND pg_catalog.length(pg_catalog.btrim(regulatory_jurisdiction)) BETWEEN 2 AND 100
      AND pg_catalog.length(pg_catalog.btrim(regulatory_evidence_ref)) BETWEEN 3 AND 240
      AND pg_catalog.length(pg_catalog.btrim(rules_version)) > 0
    )
  ) NOT VALID;

COMMENT ON COLUMN public.quiz_events.regulatory_basis IS
  'Live v2 basis: free_skill_competition, state_permit, or fccpc_registration.';
COMMENT ON COLUMN public.quiz_events.regulatory_jurisdiction IS
  'Jurisdiction covered by the documented live-prize regulatory analysis.';
COMMENT ON COLUMN public.quiz_events.regulatory_evidence_ref IS
  'Counsel advice, regulator confirmation, permit, or FCCPC filing reference; never a player projection.';
COMMENT ON COLUMN public.quiz_events.nlrc_permit_ref IS
  'Deprecated legacy compatibility field. Quiz v2 readiness uses regulatory_basis and regulatory_evidence_ref instead.';

CREATE OR REPLACE FUNCTION private.quiz_live_prize_regulatory_ready_v2(
  p_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_events AS event
    WHERE event.id = p_event_id
      AND event.contract_version = 2
      AND event.mode = 'live'
      AND event.compliance_verified IS TRUE
      AND event.regulatory_basis IN (
        'free_skill_competition',
        'state_permit',
        'fccpc_registration'
      )
      AND pg_catalog.length(pg_catalog.btrim(event.regulatory_jurisdiction)) BETWEEN 2 AND 100
      AND pg_catalog.length(pg_catalog.btrim(event.regulatory_evidence_ref)) BETWEEN 3 AND 240
      AND pg_catalog.length(pg_catalog.btrim(event.rules_version)) > 0
  );
$$;

DROP FUNCTION IF EXISTS public.launch_quiz_event_v2(
  uuid, timestamptz, timestamptz, text, integer, integer, text
);

CREATE FUNCTION public.launch_quiz_event_v2(
  p_event_id uuid,
  p_regulatory_basis text,
  p_regulatory_jurisdiction text,
  p_regulatory_evidence_ref text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_rules_version text,
  p_question_count integer,
  p_time_per_question_seconds integer,
  p_time_zone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.quiz_events%ROWTYPE;
  v_now timestamptz;
  v_slot_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT event.*
  INTO v_event
  FROM public.quiz_events AS event
  JOIN public.merchants AS merchant ON merchant.id = event.merchant_id
  WHERE event.id = p_event_id
    AND merchant.user_id = auth.uid()
  FOR UPDATE OF event;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'quiz_event_not_found' USING ERRCODE = 'QZ003';
  END IF;
  IF v_event.status <> 'draft' OR v_event.contract_version NOT IN (1, 2) THEN
    RAISE EXCEPTION 'quiz_live_launch_requires_owned_draft' USING ERRCODE = 'QZ046';
  END IF;
  IF v_event.settings->>'answer_key_reviewed' IS DISTINCT FROM 'true'
    OR pg_catalog.coalesce(
      pg_catalog.length(
        pg_catalog.btrim(v_event.settings->>'answer_key_reviewed_at')
      ),
      0
    ) = 0 THEN
    RAISE EXCEPTION 'quiz_answer_key_review_required' USING ERRCODE = 'QZ003';
  END IF;
  IF p_regulatory_basis NOT IN (
      'free_skill_competition', 'state_permit', 'fccpc_registration'
    )
    OR pg_catalog.length(pg_catalog.btrim(p_regulatory_jurisdiction)) NOT BETWEEN 2 AND 100
    OR pg_catalog.length(pg_catalog.btrim(p_regulatory_evidence_ref)) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'quiz_live_regulatory_readiness_required' USING ERRCODE = 'QZ047';
  END IF;
  IF p_question_count NOT BETWEEN 1 AND 50
    OR p_time_per_question_seconds NOT BETWEEN 5 AND 60
    OR p_starts_at IS NULL
    OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
    OR p_rules_version IS DISTINCT FROM 'live-v1'
    OR pg_catalog.length(pg_catalog.btrim(p_time_zone)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'quiz_live_timing_or_rules_invalid' USING ERRCODE = 'QZ048';
  END IF;
  IF pg_catalog.floor(EXTRACT(EPOCH FROM (p_ends_at - p_starts_at)))::integer
    NOT BETWEEN
      (p_question_count * p_time_per_question_seconds) + 30
      AND (p_question_count * p_time_per_question_seconds) + 120 THEN
    RAISE EXCEPTION 'quiz_live_window_outside_allowed_bounds' USING ERRCODE = 'QZ048';
  END IF;

  SELECT pg_catalog.count(*)::integer
  INTO v_slot_count
  FROM public.quiz_question_slots AS slot
  WHERE slot.event_id = v_event.id
    AND slot.active
    AND 3 <= (
      SELECT pg_catalog.count(*)
      FROM public.quiz_question_variants AS variant
      WHERE variant.slot_id = slot.id
        AND variant.active
    );
  IF v_slot_count <> p_question_count THEN
    RAISE EXCEPTION 'quiz_question_pool_incomplete' USING ERRCODE = 'QZ003';
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF p_ends_at <= v_now THEN
    RAISE EXCEPTION 'quiz_live_window_elapsed' USING ERRCODE = 'QZ002';
  END IF;

  -- live-v1 is intentionally allowlisted at this authoritative boundary. A
  -- future rules version must update both the TypeScript registry and this RPC.
  UPDATE public.quiz_events
  SET contract_version = 2,
      compliance_verified = true,
      regulatory_basis = p_regulatory_basis,
      regulatory_jurisdiction = pg_catalog.btrim(p_regulatory_jurisdiction),
      regulatory_evidence_ref = pg_catalog.btrim(p_regulatory_evidence_ref),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      rules_version = pg_catalog.btrim(p_rules_version),
      question_count = p_question_count,
      time_per_question_seconds = p_time_per_question_seconds,
      maximum_play_seconds = p_question_count * p_time_per_question_seconds,
      live_window_seconds = pg_catalog.floor(
        EXTRACT(EPOCH FROM (p_ends_at - p_starts_at))
      )::integer,
      max_attempts = 1,
      time_zone = pg_catalog.btrim(p_time_zone),
      mode = 'live',
      status = CASE WHEN p_starts_at <= v_now THEN 'active' ELSE 'scheduled' END,
      updated_at = v_now
  WHERE id = v_event.id
  RETURNING * INTO v_event;

  IF NOT private.quiz_live_prize_regulatory_ready_v2(v_event.id) THEN
    RAISE EXCEPTION 'quiz_live_regulatory_readiness_required' USING ERRCODE = 'QZ047';
  END IF;

  -- This requires mode=live and rolls back the whole launch if inventory is
  -- unavailable. Test events never enter this RPC or reserve a real product.
  PERFORM private.reserve_quiz_product_prize_v2(v_event.id);

  RETURN pg_catalog.jsonb_build_object(
    'contractVersion', 2,
    'endsAt', v_event.ends_at,
    'id', v_event.id,
    'mode', v_event.mode,
    'slug', v_event.slug,
    'startsAt', v_event.starts_at,
    'status', v_event.status,
    'title', v_event.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_due_live_quiz_events_v2(
  p_production_phase boolean,
  p_production_approved boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.quiz_events%ROWTYPE;
  v_winner record;
  v_awarded integer := 0;
  v_none integer := 0;
  v_blocked integer := 0;
  v_failed integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  FOR v_event IN
    SELECT event.*
    FROM public.quiz_events AS event
    WHERE event.contract_version = 2
      AND event.mode = 'live'
      AND event.ends_at <= pg_catalog.clock_timestamp()
      AND event.attempts_terminalized_at IS NOT NULL
      AND event.finalization_state IN ('pending', 'blocked')
      AND event.results_published_at IS NULL
    ORDER BY event.ends_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    IF p_production_phase IS NOT TRUE
      OR p_production_approved IS NOT TRUE
      OR NOT private.quiz_live_prize_regulatory_ready_v2(v_event.id)
      OR v_event.claim_window_seconds IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.quiz_prize_reservations AS reservation
        WHERE reservation.event_id = v_event.id AND reservation.state = 'reserved'
      ) THEN
      UPDATE public.quiz_events
      SET finalization_state = 'blocked',
          finalization_error_code = 'live_award_gate_unavailable',
          updated_at = pg_catalog.clock_timestamp()
      WHERE id = v_event.id;
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;
    BEGIN
      SELECT * INTO v_winner
      FROM private.quiz_ranked_candidates_v2(v_event.id)
      ORDER BY rank
      LIMIT 1;
      IF v_winner.attempt_id IS NULL THEN
        PERFORM private.release_quiz_prize_reservation_v2(v_event.id, 'no_eligible_winner');
        UPDATE public.quiz_events
        SET status = 'completed', finalization_state = 'no_winner', finalization_error_code = NULL,
            award_finalized_at = pg_catalog.clock_timestamp(), results_published_at = pg_catalog.clock_timestamp(),
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_event.id;
        v_none := v_none + 1;
      ELSE
        PERFORM private.transfer_quiz_prize_to_winner_v2(v_event.id, v_winner.attempt_id, v_winner.customer_id);
        UPDATE public.quiz_events
        SET status = 'completed', finalization_state = 'awarded', finalization_error_code = NULL,
            award_finalized_at = pg_catalog.clock_timestamp(), results_published_at = pg_catalog.clock_timestamp(),
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_event.id;
        v_awarded := v_awarded + 1;
      END IF;
      INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
      VALUES (v_event.id, 'quiz_v2_live_finalized', 'succeeded',
        pg_catalog.jsonb_build_object('outcome', CASE WHEN v_winner.attempt_id IS NULL THEN 'no_winner' ELSE 'awarded' END));
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.quiz_events
      SET finalization_state = 'blocked', finalization_error_code = 'live_award_transfer_failed',
          updated_at = pg_catalog.clock_timestamp()
      WHERE id = v_event.id;
      INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
      VALUES (v_event.id, 'quiz_v2_live_finalized', 'failed',
        pg_catalog.jsonb_build_object('code', 'live_award_transfer_failed'));
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object(
    'awarded', v_awarded,
    'failed', v_failed,
    'liveAwaitingGate', v_blocked + v_failed,
    'noWinner', v_none
  );
END;
$$;

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
  v_now timestamptz := pg_catalog.clock_timestamp();
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
    SELECT 1
    FROM public.customers AS customer
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
      AND event.maximum_play_seconds = event.question_count * event.time_per_question_seconds
      AND event.live_window_seconds = pg_catalog.floor(
        EXTRACT(EPOCH FROM (event.ends_at - event.starts_at))
      )::integer
      AND event.max_attempts BETWEEN 1 AND 50
      AND (event.mode <> 'live' OR event.max_attempts = 1)
      AND pg_catalog.length(pg_catalog.btrim(event.time_zone)) > 0
      AND pg_catalog.length(pg_catalog.btrim(event.rules_version)) > 0
      AND event.settings->>'prize_product_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND pg_catalog.length(pg_catalog.btrim(event.settings->>'prize_product_name')) > 0
      AND pg_catalog.length(pg_catalog.btrim(event.settings->>'prize_name')) > 0
      AND COALESCE(event.settings->>'prize_product_condition', '') IN ('', 'new', 'used', 'open_box', 'refurbished')
      AND (NULLIF(event.settings->>'prize_variant_id', '') IS NULL OR event.settings->>'prize_variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      AND (
        (event.mode = 'test' AND (
          EXISTS (
            SELECT 1 FROM public.quiz_event_testers AS tester
            WHERE tester.event_id = event.id
              AND tester.user_id = auth.uid()
              AND tester.revoked_at IS NULL
          ) OR public.has_merchant_access(event.merchant_id)
        ))
        OR (event.mode = 'live' AND private.quiz_live_prize_regulatory_ready_v2(event.id))
      )
    ORDER BY event.starts_at DESC, event.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT COALESCE(
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
          'status', CASE WHEN visible.ends_at <= v_now AND visible.results_published_at IS NULL THEN 'finalizing' ELSE visible.status END,
          'timePerQuestionSeconds', visible.time_per_question_seconds,
          'timeZone', visible.time_zone,
          'title', visible.title
        ) ORDER BY visible.starts_at DESC, visible.id
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
      'nextOffset', CASE WHEN v_returned = p_limit THEN p_offset + p_limit ELSE NULL END,
      'offset', p_offset
    ),
    'serverNow', v_now
  );
END;
$$;

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
    RETURN pg_catalog.jsonb_build_object('status', 'unavailable', 'entries', '[]'::jsonb, 'current_player', NULL);
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
  IF v_event.mode = 'live' AND NOT private.quiz_live_prize_regulatory_ready_v2(v_event.id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;
  IF v_event.status = 'cancelled' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'unavailable', 'entries', '[]'::jsonb, 'current_player', NULL);
  END IF;
  IF v_event.results_published_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'live_hidden', 'entries', '[]'::jsonb, 'current_player', NULL);
  END IF;

  WITH ranked AS (
    SELECT candidate.rank, attempt.*, candidate.total_time_seconds,
      customer.user_id, customer.deleted_at, suppression.id AS suppression_id
    FROM private.quiz_ranked_candidates_v2(v_event.id) AS candidate
    JOIN public.quiz_attempts AS attempt ON attempt.id = candidate.attempt_id
    LEFT JOIN public.customers AS customer ON customer.id = attempt.customer_id
    LEFT JOIN public.quiz_leaderboard_identity_suppressions AS suppression ON suppression.attempt_id = attempt.id
  ), projected AS (
    SELECT ranked.rank,
      pg_catalog.jsonb_build_object(
        'customer_name', CASE
          WHEN ranked.deleted_at IS NOT NULL OR ranked.suppression_id IS NOT NULL
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
  SELECT COALESCE(
      pg_catalog.jsonb_agg(projected.entry ORDER BY projected.rank) FILTER (WHERE projected.rank <= 100),
      '[]'::jsonb
    ),
    (pg_catalog.jsonb_agg(projected.entry ORDER BY projected.rank) FILTER (
      WHERE projected.customer_id = v_customer_id AND projected.rank > 100
    ))->0
  INTO v_entries, v_current_player
  FROM projected;
  RETURN pg_catalog.jsonb_build_object('status', 'published', 'entries', v_entries, 'current_player', v_current_player);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt_with_device_v2(
  p_event_id uuid,
  p_integrity_tier text,
  p_device_hash text,
  p_start_route_proof jsonb,
  p_device_route_proof jsonb,
  p_accepted_rules_version text,
  p_terms_accepted boolean,
  p_start_request_id uuid,
  p_app_version text,
  p_platform text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_id uuid;
  v_binding_diagnostic text;
  v_device_allowed boolean;
  v_event public.quiz_events%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;
  IF NOT public.quiz_route_proof_valid(
    p_device_route_proof,
    'start_quiz_attempt_with_device_v2',
    public.quiz_device_proof_subject(p_event_id, p_device_hash),
    p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;
  SELECT event.* INTO v_event
  FROM public.quiz_events AS event
  WHERE event.id = p_event_id
  FOR UPDATE;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'quiz_event_not_found' USING ERRCODE = 'QZ003';
  END IF;
  IF v_event.mode = 'live' AND NOT private.quiz_live_prize_regulatory_ready_v2(v_event.id) THEN
    RAISE EXCEPTION 'quiz_live_regulatory_readiness_required' USING ERRCODE = 'QZ047';
  END IF;

  v_result := private.start_quiz_attempt_v2_core(
    p_event_id, p_integrity_tier, p_accepted_rules_version, p_terms_accepted,
    p_start_request_id, p_app_version, p_platform, p_start_route_proof,
    p_user_id, true
  );
  v_attempt_id := NULLIF(v_result->>'attemptId', '')::uuid;
  BEGIN
    v_device_allowed := private.quiz_bind_attempt_device_v2(v_attempt_id, p_device_hash, p_user_id);
  EXCEPTION
    WHEN SQLSTATE '55P03' OR SQLSTATE '57014' OR SQLSTATE '40001' OR SQLSTATE '40P01' THEN
      IF v_event.mode = 'live' THEN
        RAISE EXCEPTION 'quiz_device_binding_unavailable' USING ERRCODE = 'QZ044';
      END IF;
      v_device_allowed := true;
      v_binding_diagnostic := 'binding_temporarily_unavailable';
  END;
  IF NOT COALESCE(v_device_allowed, false) THEN
    IF v_event.mode = 'live' THEN
      RAISE EXCEPTION 'quiz_device_limit_reached' USING ERRCODE = 'QZ041';
    END IF;
    v_binding_diagnostic := 'device_limit_reached';
  END IF;
  RETURN v_result || pg_catalog.jsonb_build_object(
    'deviceAllowed', v_device_allowed,
    'deviceBindingDiagnostic', v_binding_diagnostic
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_quiz_events_v2(uuid, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_quiz_events_v2(uuid, integer, integer)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_quiz_leaderboard_public_v2(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard_public_v2(uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.start_quiz_attempt_with_device_v2(
  uuid, text, text, jsonb, jsonb, text, boolean, uuid, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt_with_device_v2(
  uuid, text, text, jsonb, jsonb, text, boolean, uuid, text, text, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION private.quiz_live_prize_regulatory_ready_v2(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.launch_quiz_event_v2(
  uuid, text, text, text, timestamptz, timestamptz, text, integer, integer, text
)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.launch_quiz_event_v2(
  uuid, text, text, text, timestamptz, timestamptz, text, integer, integer, text
)
  TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_due_live_quiz_events_v2(boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_due_live_quiz_events_v2(boolean, boolean)
  TO service_role;
