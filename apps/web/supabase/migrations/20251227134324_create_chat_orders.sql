-- Migration: Create chat_orders table for agentic chatbot
-- This table tracks orders initiated via the AI chatbot

CREATE TABLE IF NOT EXISTS chat_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Customer information
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,

  -- Order details
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS (subtotal + COALESCE(shipping_fee, 0)) STORED,

  -- Payment details
  status TEXT NOT NULL DEFAULT 'pending_payment',
  virtual_account_number TEXT,
  virtual_account_bank TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,

  -- Shipping (optional, can be collected later)
  shipping_address JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_orders_merchant_id ON chat_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_chat_orders_session_id ON chat_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_orders_status ON chat_orders(status);
CREATE INDEX IF NOT EXISTS idx_chat_orders_virtual_account ON chat_orders(virtual_account_number);
CREATE INDEX IF NOT EXISTS idx_chat_orders_payment_ref ON chat_orders(payment_reference);

-- RLS Policies
ALTER TABLE chat_orders ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own chat orders
CREATE POLICY "Merchants can view their chat orders"
  ON chat_orders
  FOR SELECT
  USING (merchant_id = auth.uid());

-- Service role can do everything (for API operations)
CREATE POLICY "Service role has full access to chat_orders"
  ON chat_orders
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_orders_updated_at
  BEFORE UPDATE ON chat_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_orders_updated_at();

-- Add comment for documentation
COMMENT ON TABLE chat_orders IS 'Orders initiated via the AI chatbot with virtual account payment';
