-- Immutable operator replay audit for destination deliveries.

CREATE TABLE IF NOT EXISTS public.event_delivery_replays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_id uuid NOT NULL
    REFERENCES public.event_deliveries(id) ON DELETE RESTRICT,
  replay_number integer NOT NULL,
  replayed_by uuid NOT NULL,
  replay_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_delivery_replays_delivery_number_key
    UNIQUE (delivery_id, replay_number),
  CONSTRAINT event_delivery_replays_number_check CHECK (replay_number > 0),
  CONSTRAINT event_delivery_replays_reason_check
    CHECK (length(replay_reason) BETWEEN 3 AND 1000)
);

CREATE INDEX IF NOT EXISTS event_delivery_replays_created_idx
  ON public.event_delivery_replays (created_at DESC);

ALTER TABLE public.event_delivery_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_delivery_replays FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_delivery_replays
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_delivery_replays TO service_role;

DROP POLICY IF EXISTS event_delivery_replays_service_all
  ON public.event_delivery_replays;
DROP POLICY IF EXISTS event_delivery_replays_service_read
  ON public.event_delivery_replays;
CREATE POLICY event_delivery_replays_service_read
  ON public.event_delivery_replays FOR SELECT TO service_role
  USING (true);
DROP POLICY IF EXISTS event_delivery_replays_postgres_insert
  ON public.event_delivery_replays;
CREATE POLICY event_delivery_replays_postgres_insert
  ON public.event_delivery_replays FOR INSERT TO postgres
  WITH CHECK (true);

COMMENT ON TABLE public.event_delivery_replays IS
  'Immutable operator audit rows for destination dead-letter replay.';
