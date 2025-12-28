-- Create checkout_sessions table for OpenAI Agentic Commerce Protocol
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  status TEXT NOT NULL DEFAULT 'not_ready_for_payment',
  currency TEXT NOT NULL DEFAULT 'NGN',

  -- Cart data (stored as JSONB for flexibility)
  items JSONB NOT NULL DEFAULT '[]',
  line_items JSONB NOT NULL DEFAULT '[]',
  totals JSONB NOT NULL DEFAULT '[]',

  -- Fulfillment
  fulfillment_address JSONB,
  fulfillment_option_id TEXT,
  fulfillment_options JSONB NOT NULL DEFAULT '[]',

  -- Buyer info (populated on complete)
  buyer JSONB,

  -- Order reference (set after complete)
  order_id UUID REFERENCES orders(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 minutes'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant_id ON checkout_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_id ON checkout_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_created_at ON checkout_sessions(created_at);

-- RLS Policies
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Service Role only (API handles all access securely)
-- Usage: The Agentic Checkout API endpoints use the service role client
DROP POLICY IF EXISTS "Service role has full access" ON checkout_sessions;
CREATE POLICY "Service role has full access" ON checkout_sessions
    FOR ALL
    USING ( auth.role() = 'service_role' )
    WITH CHECK ( auth.role() = 'service_role' );

-- Comment
COMMENT ON TABLE checkout_sessions IS 'Stores active checkout sessions for OpenAI Agentic Commerce Protocol';
