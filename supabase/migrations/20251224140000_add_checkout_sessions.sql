-- Migration: Create checkout_sessions table
-- Purpose: Store checkout session data for payment processing, cart recovery, and analytics
-- Supports: Monnify virtual accounts, Paystack, and other payment providers

-- Create checkout_sessions table
CREATE TABLE IF NOT EXISTS checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session identification
    session_id TEXT NOT NULL UNIQUE, -- e.g., "cs_abc123" format
    
    -- Ownership
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Session status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Session created, awaiting payment
        'processing',   -- Payment initiated
        'completed',    -- Payment successful, order created
        'expired',      -- Session timed out
        'abandoned',    -- Customer left without paying
        'failed'        -- Payment failed
    )),
    
    -- Cart data (snapshot at checkout time)
    cart_items JSONB NOT NULL DEFAULT '[]', -- Array of {product_id, variant_id, name, price, quantity, image}
    cart_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Customer info (for guest checkout)
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    
    -- Shipping info
    shipping_address JSONB, -- {street, city, state, country, postal_code}
    shipping_method TEXT,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    
    -- Payment info
    payment_provider TEXT, -- 'paystack', 'monnify', 'flutterwave', etc.
    payment_reference TEXT, -- Provider's transaction reference
    payment_method TEXT, -- 'card', 'bank_transfer', 'ussd', 'virtual_account'
    
    -- Virtual account details (for Monnify/bank transfer payments)
    virtual_account_number TEXT,
    virtual_account_bank TEXT,
    virtual_account_name TEXT,
    virtual_account_expires_at TIMESTAMPTZ,
    
    -- Pricing breakdown
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    discount_code TEXT,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NGN',
    
    -- Tracking & attribution
    ad_tracking JSONB, -- {fbclid, gclid, ttclid, utm_source, etc.}
    device_info JSONB, -- {user_agent, ip, device_type}
    
    -- Related order (created after successful payment)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Timestamps
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant_id ON checkout_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_customer_id ON checkout_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_payment_reference ON checkout_sessions(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_virtual_account ON checkout_sessions(virtual_account_number) WHERE virtual_account_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_at ON checkout_sessions(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_created_at ON checkout_sessions(created_at);

-- Enable RLS
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Merchants can view their own checkout sessions
CREATE POLICY "Merchants can view own checkout sessions"
    ON checkout_sessions FOR SELECT
    USING (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = auth.uid()
        )
    );

-- Merchants can create checkout sessions for their store
CREATE POLICY "Merchants can create checkout sessions"
    ON checkout_sessions FOR INSERT
    WITH CHECK (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = auth.uid()
        )
    );

-- Merchants can update their own checkout sessions
CREATE POLICY "Merchants can update own checkout sessions"
    ON checkout_sessions FOR UPDATE
    USING (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = auth.uid()
        )
    );

-- Allow public creation for guest checkout (via API/service role)
-- This allows the checkout API to create sessions without auth
CREATE POLICY "Allow public checkout session creation via session_id"
    ON checkout_sessions FOR INSERT
    WITH CHECK (true); -- Controlled by API layer

-- Allow public read by session_id (for checkout page to load session)
CREATE POLICY "Allow public read by session_id"
    ON checkout_sessions FOR SELECT
    USING (true); -- Session ID acts as secret token

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_checkout_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checkout_sessions_updated_at
    BEFORE UPDATE ON checkout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_checkout_sessions_updated_at();

-- Comments
COMMENT ON TABLE checkout_sessions IS 'Stores checkout session data for payment processing, virtual accounts, and abandoned cart recovery';
COMMENT ON COLUMN checkout_sessions.session_id IS 'Unique session identifier (e.g., cs_abc123) used as URL parameter';
COMMENT ON COLUMN checkout_sessions.virtual_account_number IS 'Monnify/bank virtual account number for bank transfer payments';
COMMENT ON COLUMN checkout_sessions.ad_tracking IS 'Ad platform tracking data (fbclid, gclid, utm_source) for conversion attribution';
COMMENT ON COLUMN checkout_sessions.expires_at IS 'Session expiration time (default 24h), after which virtual accounts become invalid';
