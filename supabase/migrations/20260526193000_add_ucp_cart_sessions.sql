CREATE TABLE IF NOT EXISTS public.agentic_cart_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id text NOT NULL UNIQUE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  agent_id text,
  buyer jsonb NOT NULL DEFAULT '{}'::jsonb,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'NGN',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agentic_cart_sessions_status_check
    CHECK (status IN ('active', 'converted', 'canceled', 'expired')),
  CONSTRAINT agentic_cart_sessions_currency_check
    CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_agentic_cart_sessions_merchant_updated
  ON public.agentic_cart_sessions (merchant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agentic_cart_sessions_checkout_session_id
  ON public.agentic_cart_sessions (checkout_session_id);

ALTER TABLE public.agentic_cart_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agentic cart sessions are readable by scoped client"
  ON public.agentic_cart_sessions;
CREATE POLICY "Agentic cart sessions are readable by scoped client"
  ON public.agentic_cart_sessions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic cart sessions are writable by scoped client"
  ON public.agentic_cart_sessions;
CREATE POLICY "Agentic cart sessions are writable by scoped client"
  ON public.agentic_cart_sessions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

GRANT SELECT, INSERT, UPDATE ON public.agentic_cart_sessions TO authenticated;
