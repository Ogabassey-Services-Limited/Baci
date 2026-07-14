-- Close expired product-prize events and recover Phase-1a ranked finalizations.
--
-- Product-prize events do not use the ranked award minter. Once their deadline
-- passes and no live attempt remains, close them so storefronts stop presenting
-- an event that start_quiz_attempt already rejects as expired.
--
-- Before ranked minting shipped, the Phase-1a finalizer could stamp
-- award_finalized_at without creating quiz_awards. Re-admit only stamps older
-- than this fix, and only when no award exists. Re-stamping with now() makes the
-- recovery one-shot even when an event has no eligible winner.

CREATE OR REPLACE FUNCTION public.finalize_due_quiz_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_event_id uuid;
  v_ranked_event_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_product_event_id IN
    SELECT e.id
    FROM public.quiz_events e
    WHERE e.settings ? 'prize_product_id'
      AND NULLIF(pg_catalog.btrim(e.settings ->> 'prize_product_id'), '') IS NOT NULL
      AND NOT (
        e.settings ? 'ranked_prizes'
        OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount'
        OR e.settings ? 'cash_prize_amount'
      )
      AND e.status IN ('active', 'scheduled')
      AND e.ends_at IS NOT NULL
      AND e.ends_at <= pg_catalog.now() - interval '2 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.quiz_attempts a
        WHERE a.event_id = e.id
          AND a.status = 'started'
          AND a.started_at >= pg_catalog.now() - interval '1 hour'
      )
    ORDER BY e.ends_at ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.quiz_attempts
    SET status = 'expired'
    WHERE event_id = v_product_event_id
      AND status = 'started'
      AND started_at < pg_catalog.now() - interval '1 hour';

    UPDATE public.quiz_events
    SET status = 'completed',
        updated_at = pg_catalog.now()
    WHERE id = v_product_event_id
      AND status IN ('active', 'scheduled');

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  FOR v_ranked_event_id IN
    SELECT e.id
    FROM public.quiz_events e
    WHERE (
        e.award_finalized_at IS NULL
        OR (
          e.award_finalized_at < '2026-07-14 22:00:00+00'::timestamptz
          AND NOT EXISTS (
            SELECT 1
            FROM public.quiz_awards legacy_award
            WHERE legacy_award.event_id = e.id
          )
        )
      )
      AND e.compliance_verified = true
      AND e.nlrc_permit_ref IS NOT NULL
      AND pg_catalog.btrim(e.nlrc_permit_ref) <> ''
      AND e.status IN ('active', 'scheduled', 'completed')
      AND (
        e.status = 'completed'
        OR (
          e.ends_at IS NOT NULL
          AND e.ends_at <= pg_catalog.now() - interval '2 minutes'
          AND NOT EXISTS (
            SELECT 1
            FROM public.quiz_attempts a
            WHERE a.event_id = e.id
              AND a.status = 'started'
              AND a.started_at >= pg_catalog.now() - interval '1 hour'
          )
        )
      )
      AND (
        e.settings ? 'ranked_prizes'
        OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount'
        OR e.settings ? 'cash_prize_amount'
      )
    ORDER BY e.ends_at ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.quiz_events e
    SET award_finalized_at = pg_catalog.now(),
        status = CASE
          WHEN e.status IN ('active', 'scheduled') THEN 'completed'
          ELSE e.status
        END,
        updated_at = pg_catalog.now()
    WHERE e.id = v_ranked_event_id
      AND (
        e.award_finalized_at IS NULL
        OR (
          e.award_finalized_at < '2026-07-14 22:00:00+00'::timestamptz
          AND NOT EXISTS (
            SELECT 1
            FROM public.quiz_awards legacy_award
            WHERE legacy_award.event_id = e.id
          )
        )
      );

    IF FOUND THEN
      PERFORM public.mint_quiz_event_ranked_awards(v_ranked_event_id);

      INSERT INTO public.leaderboard_refresh_log (
        event_id,
        refresh_reason,
        status,
        details
      )
      VALUES (
        v_ranked_event_id,
        'cron_award_finalize_rank_winners',
        'queued',
        pg_catalog.jsonb_build_object('source', 'finalize_due_quiz_events')
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.finalize_due_quiz_events() IS
  'Service-role cron entrypoint: closes due product-prize events without ranked minting; finalizes due compliant ranked events; and retries pre-2026-07-14 Phase-1a stamps that have no awards. Concurrency-safe and idempotent.';

REVOKE ALL ON FUNCTION public.finalize_due_quiz_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_due_quiz_events() TO service_role;
