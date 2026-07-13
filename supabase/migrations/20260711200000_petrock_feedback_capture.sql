CREATE TABLE IF NOT EXISTS public.petrock_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_id uuid NOT NULL REFERENCES public.imei_lookups(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  content_type text,
  body_sha256 text NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  body_bytes integer NOT NULL CHECK (body_bytes >= 0 AND body_bytes <= 32768),
  body_keys text[] NOT NULL DEFAULT '{}',
  query_keys text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_petrock_feedback_events_lookup_received
  ON public.petrock_feedback_events (lookup_id, received_at DESC);

ALTER TABLE public.petrock_feedback_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.petrock_feedback_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.petrock_feedback_events TO service_role;

COMMENT ON TABLE public.petrock_feedback_events IS
  'Private metadata-only capture of untrusted Petrock callbacks; callback values are never persisted or trusted.';
