ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.checkout_sessions.metadata IS
  'Agentic checkout metadata including calculated cart state, DVA details, request audit data, and idempotency records.';

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_metadata_agentic
  ON public.checkout_sessions USING gin ((metadata -> 'agentic'));
