-- Phase 1a quiz foundation. These objects are intentionally minimal: Phase 1b
-- can layer scoring, fraud review, and wallet/order prize fulfillment on top.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.quiz_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  award_finalized_at timestamptz,
  compliance_verified boolean NOT NULL DEFAULT false,
  nlrc_permit_ref text,
  published_odds jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.quiz_question_slots (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  slot_index integer NOT NULL CHECK (slot_index > 0),
  category text,
  difficulty text NOT NULL DEFAULT 'standard',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slot_index)
);

CREATE TABLE IF NOT EXISTS public.quiz_question_variants (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  slot_id uuid NOT NULL REFERENCES public.quiz_question_slots(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key_hash text,
  explanation text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, variant_key)
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted', 'scored', 'disqualified')),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  integrity_tier text NOT NULL DEFAULT 'unknown',
  route_proof_id text,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, customer_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_questions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.quiz_question_slots(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.quiz_question_variants(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, position),
  UNIQUE (attempt_id, slot_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_answers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attempt_question_id uuid NOT NULL REFERENCES public.quiz_attempt_questions(id) ON DELETE CASCADE,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  answered_at timestamptz NOT NULL DEFAULT now(),
  score_delta integer NOT NULL DEFAULT 0,
  UNIQUE (attempt_question_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_awards (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  award_type text NOT NULL CHECK (award_type IN ('grand', 'cash', 'store_credit')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'claimed', 'void')),
  amount numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  route_proof_id text,
  approved_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_signal_flags (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'block')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, signal_key)
);

CREATE TABLE IF NOT EXISTS public.quiz_integrity_challenges (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  challenge_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'expired')),
  proof_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_proof_validation_failures (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  proof_id_hash text,
  user_id_hash text,
  subject_id text,
  action text,
  version text,
  scope text,
  payload_hash text,
  issued_at text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_compliance_tracker (
  item text PRIMARY KEY,
  verification_status text,
  approved_at timestamptz,
  approval_comment text,
  evidence_link text,
  source_reference_checked_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_refresh_log (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  refresh_reason text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_events_status ON public.quiz_events(status, starts_at, ends_at);
-- Consolidated from the removed 20260516143000 duplicate index migration.
CREATE INDEX IF NOT EXISTS idx_quiz_events_merchant ON public.quiz_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_quiz_slots_event ON public.quiz_question_slots(event_id, active);
CREATE INDEX IF NOT EXISTS idx_quiz_variants_slot ON public.quiz_question_variants(slot_id, active);
CREATE INDEX IF NOT EXISTS idx_quiz_variants_answer_key_hash ON public.quiz_question_variants(answer_key_hash);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_event ON public.quiz_attempts(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_customer ON public.quiz_attempts(customer_id, event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_attempt ON public.quiz_attempt_questions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_slot ON public.quiz_attempt_questions(slot_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_variant ON public.quiz_attempt_questions(variant_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON public.quiz_attempt_answers(attempt_question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_awards_event_status ON public.quiz_awards(event_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_awards_customer ON public.quiz_awards(customer_id);
CREATE INDEX IF NOT EXISTS idx_quiz_awards_attempt ON public.quiz_awards(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_signal_flags_attempt ON public.quiz_attempt_signal_flags(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_integrity_challenges_attempt ON public.quiz_integrity_challenges(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proof_failures_created ON public.quiz_proof_validation_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_compliance_tracker_status ON public.quiz_compliance_tracker(verification_status, approved_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_refresh_log_event ON public.leaderboard_refresh_log(event_id, created_at DESC);

ALTER TABLE public.quiz_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_question_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_question_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_signal_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_integrity_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_proof_validation_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_compliance_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_refresh_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quiz_events, public.quiz_question_slots, public.quiz_question_variants,
  public.quiz_attempts, public.quiz_attempt_questions, public.quiz_attempt_answers,
  public.quiz_awards, public.quiz_attempt_signal_flags, public.quiz_integrity_challenges,
  public.quiz_proof_validation_failures, public.quiz_compliance_tracker,
  public.leaderboard_refresh_log FROM anon, authenticated;

GRANT SELECT (id, merchant_id, slug, title, status, starts_at, ends_at, settings, created_at, updated_at)
  ON public.quiz_events TO authenticated;
GRANT SELECT (id, event_id, slot_index, category, difficulty, active, created_at)
  ON public.quiz_question_slots TO authenticated;
GRANT SELECT (id, prompt, options)
  ON public.quiz_question_variants TO authenticated;
GRANT SELECT ON public.quiz_attempts, public.quiz_attempt_questions, public.quiz_attempt_answers,
  public.quiz_awards, public.quiz_attempt_signal_flags, public.quiz_integrity_challenges,
  public.leaderboard_refresh_log TO authenticated;
GRANT SELECT ON public.quiz_proof_validation_failures, public.quiz_compliance_tracker TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_events_client_read' AND polrelid = 'public.quiz_events'::regclass) THEN
    CREATE POLICY quiz_events_client_read ON public.quiz_events FOR SELECT TO authenticated USING (status IN ('scheduled', 'active', 'completed') AND EXISTS (SELECT 1 FROM public.customers c WHERE c.merchant_id = quiz_events.merchant_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_slots_client_read' AND polrelid = 'public.quiz_question_slots'::regclass) THEN
    CREATE POLICY quiz_slots_client_read ON public.quiz_question_slots FOR SELECT TO authenticated USING (active AND EXISTS (SELECT 1 FROM public.quiz_attempt_questions aq JOIN public.quiz_attempts a ON a.id = aq.attempt_id JOIN public.customers c ON c.id = a.customer_id WHERE aq.slot_id = quiz_question_slots.id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_variants_client_read' AND polrelid = 'public.quiz_question_variants'::regclass) THEN
    CREATE POLICY quiz_variants_client_read ON public.quiz_question_variants FOR SELECT TO authenticated USING (active AND EXISTS (SELECT 1 FROM public.quiz_attempt_questions aq JOIN public.quiz_attempts a ON a.id = aq.attempt_id JOIN public.customers c ON c.id = a.customer_id WHERE aq.variant_id = quiz_question_variants.id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_attempts_customer_read' AND polrelid = 'public.quiz_attempts'::regclass) THEN
    CREATE POLICY quiz_attempts_customer_read ON public.quiz_attempts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_attempt_questions_customer_read' AND polrelid = 'public.quiz_attempt_questions'::regclass) THEN
    CREATE POLICY quiz_attempt_questions_customer_read ON public.quiz_attempt_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quiz_attempts a JOIN public.customers c ON c.id = a.customer_id WHERE a.id = attempt_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_attempt_answers_customer_read' AND polrelid = 'public.quiz_attempt_answers'::regclass) THEN
    CREATE POLICY quiz_attempt_answers_customer_read ON public.quiz_attempt_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quiz_attempt_questions q JOIN public.quiz_attempts a ON a.id = q.attempt_id JOIN public.customers c ON c.id = a.customer_id WHERE q.id = attempt_question_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_awards_customer_read' AND polrelid = 'public.quiz_awards'::regclass) THEN
    CREATE POLICY quiz_awards_customer_read ON public.quiz_awards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_signal_flags_customer_read' AND polrelid = 'public.quiz_attempt_signal_flags'::regclass) THEN
    CREATE POLICY quiz_signal_flags_customer_read ON public.quiz_attempt_signal_flags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quiz_attempts a JOIN public.customers c ON c.id = a.customer_id WHERE a.id = attempt_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'quiz_integrity_challenges_customer_read' AND polrelid = 'public.quiz_integrity_challenges'::regclass) THEN
    CREATE POLICY quiz_integrity_challenges_customer_read ON public.quiz_integrity_challenges FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quiz_attempts a JOIN public.customers c ON c.id = a.customer_id WHERE a.id = attempt_id AND c.user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'leaderboard_refresh_log_client_read' AND polrelid = 'public.leaderboard_refresh_log'::regclass) THEN
    CREATE POLICY leaderboard_refresh_log_client_read ON public.leaderboard_refresh_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quiz_events e JOIN public.customers c ON c.merchant_id = e.merchant_id WHERE e.id = event_id AND e.status IN ('active', 'completed') AND c.user_id = (SELECT auth.uid())));
  END IF;
END $$;
