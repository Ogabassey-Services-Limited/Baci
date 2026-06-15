-- Merchant Feature Settings
-- Allows merchants to enable/disable and configure platform features for their store

-- Create the merchant_feature_settings table
CREATE TABLE IF NOT EXISTS merchant_feature_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Feature toggles (enabled/disabled)
    loyalty_enabled BOOLEAN DEFAULT false,
    reviews_enabled BOOLEAN DEFAULT true,
    wishlist_enabled BOOLEAN DEFAULT true,
    order_tracking_enabled BOOLEAN DEFAULT true,
    discount_codes_enabled BOOLEAN DEFAULT true,
    guest_checkout_enabled BOOLEAN DEFAULT true,

    -- Shipping configuration
    shipping_providers JSONB DEFAULT '["gigl", "topship", "shiip"]'::jsonb,
    free_shipping_threshold DECIMAL(12, 2) DEFAULT NULL,
    shipping_markup_percentage DECIMAL(5, 2) DEFAULT 0,

    -- Checkout configuration
    checkout_collect_phone BOOLEAN DEFAULT true,
    checkout_require_account BOOLEAN DEFAULT false,
    checkout_show_order_notes BOOLEAN DEFAULT true,

    -- Store pages toggles
    about_page_enabled BOOLEAN DEFAULT true,
    contact_page_enabled BOOLEAN DEFAULT true,
    faq_page_enabled BOOLEAN DEFAULT true,
    privacy_page_enabled BOOLEAN DEFAULT true,
    terms_page_enabled BOOLEAN DEFAULT true,
    rewards_page_enabled BOOLEAN DEFAULT false, -- Tied to loyalty_enabled

    -- Social proof settings
    show_recent_purchases BOOLEAN DEFAULT false,
    show_stock_levels BOOLEAN DEFAULT true,
    low_stock_threshold INTEGER DEFAULT 10,

    -- Analytics & tracking
    google_analytics_id VARCHAR(50) DEFAULT NULL,
    facebook_pixel_id VARCHAR(50) DEFAULT NULL,
    tiktok_pixel_id VARCHAR(50) DEFAULT NULL,

    -- SEO settings
    auto_generate_schema BOOLEAN DEFAULT true,
    custom_robots_txt TEXT DEFAULT NULL,

    -- Notification preferences
    email_notifications_enabled BOOLEAN DEFAULT true,
    sms_notifications_enabled BOOLEAN DEFAULT false,

    -- Advanced settings (JSON for flexibility)
    custom_settings JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(merchant_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchant_feature_settings_merchant_id
ON merchant_feature_settings(merchant_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_feature_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_merchant_feature_settings_updated_at
    BEFORE UPDATE ON merchant_feature_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_feature_settings_updated_at();

-- Enable RLS
ALTER TABLE merchant_feature_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view/edit their own settings
CREATE POLICY "Merchants can manage their own feature settings"
ON merchant_feature_settings
FOR ALL
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

-- Policy: Service role can access all settings
CREATE POLICY "Service role can access all feature settings"
ON merchant_feature_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to get or create default feature settings for a merchant
CREATE OR REPLACE FUNCTION get_or_create_merchant_feature_settings(p_merchant_id UUID)
RETURNS merchant_feature_settings AS $$
DECLARE
    v_settings merchant_feature_settings;
BEGIN
    -- Try to get existing settings
    SELECT * INTO v_settings
    FROM merchant_feature_settings
    WHERE merchant_id = p_merchant_id;

    -- If not found, create with defaults
    IF NOT FOUND THEN
        INSERT INTO merchant_feature_settings (merchant_id)
        VALUES (p_merchant_id)
        RETURNING * INTO v_settings;
    END IF;

    RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON TABLE merchant_feature_settings IS 'Stores per-merchant feature toggles and configuration for platform features';
