-- Backfill quiz_attempts.score for attempts submitted BEFORE score persistence.
--
-- 20260706120000_quiz_fix_least_greatest_and_score_persist.sql began persisting
-- `quiz_attempts.score = SUM(quiz_attempt_answers.score_delta)` on final
-- submission. Rows submitted before that migration keep the old default
-- `score = 0`, and public.get_quiz_leaderboard ranks by `score` — so historical
-- leaderboards stay corrupted (those attempts can never resubmit to trigger the
-- recompute). Recompute from the answer ledger using the SAME formula the RPC
-- uses, for already-submitted attempts only.
--
-- Idempotent: `IS DISTINCT FROM` limits the write to rows whose stored score
-- disagrees with the recomputed value, so re-running is a no-op.

UPDATE public.quiz_attempts a
SET score = COALESCE(agg.total_score, 0)
FROM (
  SELECT
    q.attempt_id,
    SUM(ans.score_delta)::integer AS total_score
  FROM public.quiz_attempt_questions q
  LEFT JOIN public.quiz_attempt_answers ans
    ON ans.attempt_question_id = q.id
  GROUP BY q.attempt_id
) agg
WHERE a.id = agg.attempt_id
  AND a.status = 'submitted'
  AND a.score IS DISTINCT FROM COALESCE(agg.total_score, 0);
