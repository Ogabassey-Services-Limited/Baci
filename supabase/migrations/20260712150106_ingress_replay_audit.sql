-- Immutable operator audit for ingress dead-letter replay.

CREATE TABLE IF NOT EXISTS public.domain_event_failure_replays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  failure_id uuid NOT NULL
    REFERENCES public.domain_event_failures(id) ON DELETE RESTRICT,
  replay_number integer NOT NULL,
  queue_message_id bigint NOT NULL,
  replayed_by uuid NOT NULL,
  replay_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_event_failure_replays_failure_number_key
    UNIQUE (failure_id, replay_number),
  CONSTRAINT domain_event_failure_replays_number_check
    CHECK (replay_number > 0),
  CONSTRAINT domain_event_failure_replays_reason_check
    CHECK (length(replay_reason) BETWEEN 3 AND 1000)
);

CREATE INDEX IF NOT EXISTS domain_event_failure_replays_created_idx
  ON public.domain_event_failure_replays (created_at DESC);

ALTER TABLE public.domain_event_failure_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_failure_replays FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.domain_event_failure_replays
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.domain_event_failure_replays TO service_role;

DROP POLICY IF EXISTS domain_event_failure_replays_service_all
  ON public.domain_event_failure_replays;
DROP POLICY IF EXISTS domain_event_failure_replays_service_read
  ON public.domain_event_failure_replays;
CREATE POLICY domain_event_failure_replays_service_read
  ON public.domain_event_failure_replays FOR SELECT TO service_role
  USING (true);
DROP POLICY IF EXISTS domain_event_failure_replays_postgres_insert
  ON public.domain_event_failure_replays;
CREATE POLICY domain_event_failure_replays_postgres_insert
  ON public.domain_event_failure_replays FOR INSERT TO postgres
  WITH CHECK (true);

COMMENT ON TABLE public.domain_event_failure_replays IS
  'Immutable operator audit rows for ingress dead-letter replay.';
