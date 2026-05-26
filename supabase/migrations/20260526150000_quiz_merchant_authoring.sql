-- Allow authenticated merchant owners and active staff to author quiz drafts.
-- Customer-facing reads still cannot see answer_key_hash or explanations.

GRANT INSERT, UPDATE, DELETE ON public.quiz_events TO authenticated;
GRANT INSERT, UPDATE ON public.quiz_question_slots TO authenticated;
GRANT INSERT, UPDATE ON public.quiz_question_variants TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_events_merchant_author_read'
      AND polrelid = 'public.quiz_events'::regclass
  ) THEN
    CREATE POLICY quiz_events_merchant_author_read
      ON public.quiz_events
      FOR SELECT
      TO authenticated
      USING (public.has_merchant_access(merchant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_events_merchant_author_write'
      AND polrelid = 'public.quiz_events'::regclass
  ) THEN
    CREATE POLICY quiz_events_merchant_author_write
      ON public.quiz_events
      FOR ALL
      TO authenticated
      USING (public.has_merchant_access(merchant_id))
      WITH CHECK (public.has_merchant_access(merchant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_slots_merchant_author_read'
      AND polrelid = 'public.quiz_question_slots'::regclass
  ) THEN
    CREATE POLICY quiz_slots_merchant_author_read
      ON public.quiz_question_slots
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.quiz_events
          WHERE quiz_events.id = quiz_question_slots.event_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_slots_merchant_author_write'
      AND polrelid = 'public.quiz_question_slots'::regclass
  ) THEN
    CREATE POLICY quiz_slots_merchant_author_write
      ON public.quiz_question_slots
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.quiz_events
          WHERE quiz_events.id = quiz_question_slots.event_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.quiz_events
          WHERE quiz_events.id = quiz_question_slots.event_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_variants_merchant_author_read'
      AND polrelid = 'public.quiz_question_variants'::regclass
  ) THEN
    CREATE POLICY quiz_variants_merchant_author_read
      ON public.quiz_question_variants
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.quiz_question_slots
          JOIN public.quiz_events ON quiz_events.id = quiz_question_slots.event_id
          WHERE quiz_question_slots.id = quiz_question_variants.slot_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'quiz_variants_merchant_author_write'
      AND polrelid = 'public.quiz_question_variants'::regclass
  ) THEN
    CREATE POLICY quiz_variants_merchant_author_write
      ON public.quiz_question_variants
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.quiz_question_slots
          JOIN public.quiz_events ON quiz_events.id = quiz_question_slots.event_id
          WHERE quiz_question_slots.id = quiz_question_variants.slot_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.quiz_question_slots
          JOIN public.quiz_events ON quiz_events.id = quiz_question_slots.event_id
          WHERE quiz_question_slots.id = quiz_question_variants.slot_id
            AND public.has_merchant_access(quiz_events.merchant_id)
        )
      );
  END IF;
END $$;
