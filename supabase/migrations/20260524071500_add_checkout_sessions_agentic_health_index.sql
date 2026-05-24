CREATE INDEX IF NOT EXISTS idx_checkout_sessions_agentic_health
  ON public.checkout_sessions (merchant_id, updated_at DESC)
  WHERE metadata -> 'agentic' IS NOT NULL;
