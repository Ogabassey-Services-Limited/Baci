-- Shipping Providers Integration: GIGL + Topship + Shiip
-- Creates tables for multi-provider shipping, quote caching, and webhook events

-- ============================================================================
-- 1. SHIPMENTS TABLE - Stores actual shipment records
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,

    -- Provider info
    provider_code TEXT NOT NULL CHECK (provider_code IN ('GIGL', 'TOPSHIP', 'SHIIP')),
    provider_shipment_id TEXT,            -- Provider's internal ID
    tracking_number TEXT,
    carrier_name TEXT,                    -- Actual carrier: DHL, FedEx, GIG Logistics, etc.
    service_tier TEXT,                    -- Budget, Express, Premium

    -- Pricing
    quoted_price DECIMAL(12, 2),
    currency TEXT DEFAULT 'NGN',

    -- Status (normalized across all providers)
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN (
        'pending', 'booked', 'pickup_scheduled', 'picked_up',
        'in_transit', 'out_for_delivery', 'delivered',
        'cancelled', 'failed', 'returned'
    )),

    -- Delivery info
    estimated_delivery TIMESTAMPTZ,
    actual_delivery TIMESTAMPTZ,
    label_url TEXT,

    -- GIGL-specific: Station pickup (for areas without home delivery)
    is_station_pickup BOOLEAN DEFAULT false,
    pickup_station_name TEXT,
    pickup_station_address TEXT,

    -- Address snapshots (preserved even if order address changes)
    sender_address JSONB NOT NULL,
    receiver_address JSONB NOT NULL,
    items JSONB NOT NULL,

    -- Metadata
    provider_response JSONB,              -- Raw booking response for debugging
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. SHIPPING QUOTES TABLE - Cached quotes from providers
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,             -- Cart session or checkout session ID
    provider_code TEXT NOT NULL CHECK (provider_code IN ('GIGL', 'TOPSHIP', 'SHIIP', 'FALLBACK')),
    service_tier TEXT,
    carrier_name TEXT,                    -- Actual carrier name
    price DECIMAL(12, 2) NOT NULL,
    estimated_days INT,
    provider_rate_id TEXT,                -- For booking reference (Shiip redis_key, etc.)

    -- Route info for cache key matching
    sender_city TEXT,
    sender_state TEXT,
    receiver_city TEXT,
    receiver_state TEXT,
    receiver_country TEXT DEFAULT 'NG',
    total_weight DECIMAL(10, 3),

    -- Insurance included in price
    insurance_included BOOLEAN DEFAULT true,

    -- GIGL-specific
    is_station_pickup BOOLEAN DEFAULT false,
    pickup_station_id INT,
    pickup_station_name TEXT,

    expires_at TIMESTAMPTZ NOT NULL,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. WEBHOOK EVENTS TABLE - Audit log for provider webhooks
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code TEXT NOT NULL CHECK (provider_code IN ('GIGL', 'TOPSHIP', 'SHIIP')),
    event_type TEXT,
    tracking_number TEXT,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_id ON shipments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider_code);

CREATE INDEX IF NOT EXISTS idx_shipping_quotes_session ON shipping_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_expires ON shipping_quotes(expires_at);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_route ON shipping_quotes(sender_city, receiver_city, receiver_country);

CREATE INDEX IF NOT EXISTS idx_shipping_webhook_tracking ON shipping_webhook_events(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_webhook_processed ON shipping_webhook_events(processed);

-- ============================================================================
-- 5. MODIFY MERCHANTS TABLE - Add fulfillment settings
-- ============================================================================
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS self_fulfillment_enabled BOOLEAN DEFAULT false;

-- ============================================================================
-- 6. MODIFY ORDERS TABLE - Add fulfillment fields
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'provider' CHECK (fulfillment_type IN ('provider', 'self'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS self_fulfillment_data JSONB;
-- self_fulfillment_data structure: { trackingNumber, dispatchPhone, carrierName }

-- Add selected shipping quote reference
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_quote_id UUID REFERENCES shipping_quotes(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12, 2) DEFAULT 0;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_webhook_events ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own shipments
CREATE POLICY "Merchants can manage own shipments" ON shipments
    FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Customers can view shipments for their orders
CREATE POLICY "Customers can view shipments for their orders" ON shipments
    FOR SELECT USING (order_id IN (
        SELECT id FROM orders WHERE customer_id IN (
            SELECT id FROM customers WHERE user_id = auth.uid()
        )
    ));

-- Anyone can create quotes (during checkout)
CREATE POLICY "Public can create quotes" ON shipping_quotes
    FOR INSERT WITH CHECK (true);

-- Anyone can read quotes by session (for checkout flow)
CREATE POLICY "Public can read quotes" ON shipping_quotes
    FOR SELECT USING (true);

-- Webhook events - only service role can manage (handled by API)
CREATE POLICY "Service role manages webhook events" ON shipping_webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shipments_updated_at ON shipments;
CREATE TRIGGER trigger_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_shipments_updated_at();

-- ============================================================================
-- 9. CLEANUP FUNCTION - Remove expired quotes (run via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_shipping_quotes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM shipping_quotes WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. HELPER FUNCTION - Get shipment by order
-- ============================================================================
CREATE OR REPLACE FUNCTION get_order_shipment(order_id_param UUID)
RETURNS SETOF shipments AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM shipments
    WHERE order_id = order_id_param
    ORDER BY created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE shipments IS 'Stores shipment records from shipping providers (GIGL, Topship, Shiip)';
COMMENT ON TABLE shipping_quotes IS 'Cached shipping quotes with TTL for checkout flow';
COMMENT ON TABLE shipping_webhook_events IS 'Audit log for shipping provider webhook events';
COMMENT ON COLUMN shipments.carrier_name IS 'Actual carrier name shown to customers (DHL, FedEx, GIG Logistics) - NOT aggregator names';
COMMENT ON COLUMN shipments.is_station_pickup IS 'GIGL-specific: true if delivery is to service center (not home delivery)';
COMMENT ON COLUMN orders.fulfillment_type IS 'provider = use shipping provider, self = merchant handles fulfillment';
COMMENT ON COLUMN orders.self_fulfillment_data IS 'JSON: { trackingNumber, dispatchPhone, carrierName }';
