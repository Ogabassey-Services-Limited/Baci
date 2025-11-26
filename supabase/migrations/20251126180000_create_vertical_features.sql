-- Migration: Create Vertical Features System
-- Description: Adds vertical-specific and universal feature configuration for multi-vertical e-commerce
-- Author: Claude
-- Date: 2025-11-26

-- =====================================================
-- 1. CREATE VERTICAL FEATURES TABLE
-- Defines features specific to certain business types
-- =====================================================

CREATE TABLE IF NOT EXISTS vertical_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT UNIQUE NOT NULL,           -- 'ai_tryon', 'imei_tracking', 'size_guide'
    feature_name TEXT NOT NULL,                  -- 'AI Virtual Try-On', 'IMEI Tracking'
    description TEXT,
    business_types TEXT[] NOT NULL,              -- ['fashion', 'health-beauty'] - which verticals can use this
    feature_category TEXT NOT NULL,              -- 'storefront', 'product', 'checkout', 'inventory', 'analytics'
    feature_type TEXT NOT NULL DEFAULT 'optional', -- 'core' (always on), 'optional', 'premium'
    default_enabled BOOLEAN DEFAULT false,
    config_schema JSONB,                         -- JSON schema for feature configuration
    ui_component TEXT,                           -- React component name if any
    api_endpoint TEXT,                           -- API endpoint if any
    dependencies TEXT[],                         -- Other feature_keys this depends on
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_vertical_features_business_types ON vertical_features USING GIN(business_types);
CREATE INDEX idx_vertical_features_category ON vertical_features(feature_category);
CREATE INDEX idx_vertical_features_active ON vertical_features(is_active) WHERE is_active = true;

-- =====================================================
-- 2. CREATE UNIVERSAL FEATURES TABLE
-- Features that work across all business types (payment, shipping, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS universal_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT UNIQUE NOT NULL,            -- 'stripe', 'paystack', 'dhl_shipping'
    feature_name TEXT NOT NULL,                  -- 'Stripe Payments', 'DHL Shipping'
    description TEXT,
    feature_category TEXT NOT NULL,              -- 'payment', 'shipping', 'analytics', 'communication'
    provider_type TEXT,                          -- 'payment_gateway', 'shipping_carrier', 'email_service'
    config_schema JSONB,                         -- Required config fields
    credentials_schema JSONB,                    -- API keys, secrets needed
    webhook_endpoint TEXT,                       -- Webhook handler if any
    supported_regions TEXT[],                    -- ['NG', 'GH', 'US', 'GB', '*']
    supported_currencies TEXT[],                 -- ['USD', 'NGN', 'GHS', '*']
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_universal_features_category ON universal_features(feature_category);
CREATE INDEX idx_universal_features_active ON universal_features(is_active) WHERE is_active = true;
CREATE INDEX idx_universal_features_regions ON universal_features USING GIN(supported_regions);

-- =====================================================
-- 3. ADD ENABLED FEATURES TO MERCHANTS
-- =====================================================

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS feature_config JSONB DEFAULT '{}'::jsonb;

-- enabled_features example: { "ai_tryon": true, "size_guide": true, "imei_tracking": false }
-- feature_config example: { "ai_tryon": { "model": "v2", "quality": "high" }, "stripe": { "mode": "live" } }

COMMENT ON COLUMN merchants.enabled_features IS 'Feature toggle map: { feature_key: boolean }';
COMMENT ON COLUMN merchants.feature_config IS 'Per-feature configuration: { feature_key: { config_options } }';

-- Create index for querying merchants by features
CREATE INDEX IF NOT EXISTS idx_merchants_enabled_features ON merchants USING GIN(enabled_features);

-- =====================================================
-- 4. CREATE MERCHANT FEATURE CREDENTIALS TABLE
-- Stores sensitive credentials for universal features (encrypted)
-- =====================================================

CREATE TABLE IF NOT EXISTS merchant_feature_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    credentials JSONB NOT NULL,                  -- Encrypted credentials
    environment TEXT DEFAULT 'test',             -- 'test', 'production'
    is_active BOOLEAN DEFAULT true,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(merchant_id, feature_key, environment)
);

-- RLS for merchant credentials
ALTER TABLE merchant_feature_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own credentials"
    ON merchant_feature_credentials FOR SELECT
    USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can manage own credentials"
    ON merchant_feature_credentials FOR ALL
    USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- =====================================================
-- 5. SEED VERTICAL FEATURES
-- =====================================================

INSERT INTO vertical_features (feature_key, feature_name, description, business_types, feature_category, feature_type, default_enabled, sort_order) VALUES
-- Fashion vertical features
('size_guide', 'Size Guide Builder', 'Create and display size charts for clothing items', ARRAY['fashion'], 'product', 'optional', true, 10),
('ai_tryon', 'AI Virtual Try-On', 'Let customers virtually try on clothes using AI', ARRAY['fashion'], 'storefront', 'premium', false, 20),
('color_variants', 'Color Variant Swatches', 'Show color options as visual swatches', ARRAY['fashion', 'home-goods'], 'product', 'optional', true, 30),
('material_info', 'Material & Care Information', 'Display fabric composition and care instructions', ARRAY['fashion'], 'product', 'optional', true, 40),
('lookbook_gallery', 'Lookbook Gallery', 'Showcase outfits and styled looks', ARRAY['fashion'], 'storefront', 'optional', false, 50),
('outfit_builder', 'Outfit Builder', 'Let customers build complete outfits', ARRAY['fashion'], 'storefront', 'premium', false, 60),

-- Electronics vertical features
('imei_tracking', 'IMEI/Serial Number Tracking', 'Track individual devices by IMEI or serial number', ARRAY['electronics'], 'inventory', 'optional', true, 10),
('warranty_management', 'Warranty Management', 'Track and manage product warranties', ARRAY['electronics'], 'product', 'optional', true, 20),
('tech_specs', 'Technical Specifications', 'Display detailed product specifications', ARRAY['electronics'], 'product', 'core', true, 30),
('spec_comparison', 'Product Comparison Tool', 'Let customers compare product specifications', ARRAY['electronics'], 'storefront', 'optional', false, 40),
('compatibility_checker', 'Compatibility Checker', 'Check device compatibility', ARRAY['electronics'], 'storefront', 'premium', false, 50),
('extended_warranty', 'Extended Warranty Upsell', 'Offer extended warranty at checkout', ARRAY['electronics'], 'checkout', 'optional', false, 60),

-- Food & Beverage vertical features
('nutrition_facts', 'Nutrition Facts', 'Display nutritional information', ARRAY['food-beverage'], 'product', 'optional', true, 10),
('allergen_info', 'Allergen Information', 'Display allergen warnings and information', ARRAY['food-beverage'], 'product', 'core', true, 20),
('expiry_tracking', 'Expiry Date Tracking', 'Track product expiration dates in inventory', ARRAY['food-beverage'], 'inventory', 'optional', true, 30),
('recipe_suggestions', 'Recipe Suggestions', 'Show recipe ideas using products', ARRAY['food-beverage'], 'storefront', 'optional', false, 40),
('dietary_filters', 'Dietary Preference Filters', 'Filter by vegan, halal, kosher, etc.', ARRAY['food-beverage'], 'storefront', 'optional', true, 50),

-- Health & Beauty vertical features
('ingredient_list', 'Ingredient List', 'Display full ingredient lists', ARRAY['health-beauty'], 'product', 'core', true, 10),
('skin_type_filters', 'Skin Type Filters', 'Filter products by skin type', ARRAY['health-beauty'], 'storefront', 'optional', true, 20),
('routine_builder', 'Skincare Routine Builder', 'Help customers build skincare routines', ARRAY['health-beauty'], 'storefront', 'premium', false, 30),
('before_after', 'Before/After Gallery', 'Show product results with before/after images', ARRAY['health-beauty'], 'product', 'optional', false, 40),

-- Home Goods vertical features
('room_visualizer', 'Room Visualizer AR', 'AR tool to visualize furniture in room', ARRAY['home-goods'], 'storefront', 'premium', false, 10),
('dimension_guide', 'Dimension Guide', 'Show detailed dimensions with diagrams', ARRAY['home-goods'], 'product', 'optional', true, 20),
('assembly_info', 'Assembly Information', 'Display assembly requirements and instructions', ARRAY['home-goods'], 'product', 'optional', true, 30),
('style_collections', 'Style Collections', 'Group products by interior design styles', ARRAY['home-goods'], 'storefront', 'optional', false, 40),

-- Handmade/Artisan vertical features
('maker_story', 'Maker Story', 'Display artisan/maker profile and story', ARRAY['handmade'], 'storefront', 'optional', true, 10),
('custom_orders', 'Custom Order Requests', 'Accept custom/personalized orders', ARRAY['handmade'], 'checkout', 'optional', true, 20),
('crafting_process', 'Crafting Process Gallery', 'Show how items are made', ARRAY['handmade'], 'product', 'optional', false, 30),
('limited_editions', 'Limited Edition Tracking', 'Track limited edition/numbered items', ARRAY['handmade'], 'inventory', 'optional', false, 40)

ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description,
    business_types = EXCLUDED.business_types,
    feature_category = EXCLUDED.feature_category,
    updated_at = now();

-- =====================================================
-- 6. SEED UNIVERSAL FEATURES
-- =====================================================

INSERT INTO universal_features (feature_key, feature_name, description, feature_category, provider_type, supported_regions, supported_currencies, sort_order) VALUES
-- Payment providers
('stripe', 'Stripe Payments', 'Accept credit cards via Stripe', 'payment', 'payment_gateway', ARRAY['US', 'GB', 'EU', 'CA', 'AU', 'SG'], ARRAY['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD'], 10),
('paystack', 'Paystack Payments', 'Accept payments in Africa via Paystack', 'payment', 'payment_gateway', ARRAY['NG', 'GH', 'ZA', 'KE'], ARRAY['NGN', 'GHS', 'ZAR', 'KES'], 20),
('flutterwave', 'Flutterwave Payments', 'Accept payments across Africa', 'payment', 'payment_gateway', ARRAY['NG', 'GH', 'ZA', 'KE', 'TZ', 'UG', 'RW'], ARRAY['NGN', 'GHS', 'ZAR', 'KES', 'TZS', 'UGX', 'RWF', 'USD'], 30),
('paypal', 'PayPal Payments', 'Accept PayPal payments globally', 'payment', 'payment_gateway', ARRAY['*'], ARRAY['*'], 40),

-- Shipping providers
('dhl_express', 'DHL Express', 'International express shipping via DHL', 'shipping', 'shipping_carrier', ARRAY['*'], ARRAY['*'], 10),
('fedex', 'FedEx', 'Global shipping via FedEx', 'shipping', 'shipping_carrier', ARRAY['*'], ARRAY['*'], 20),
('ups', 'UPS', 'Shipping via UPS', 'shipping', 'shipping_carrier', ARRAY['US', 'CA', 'EU', 'GB'], ARRAY['*'], 30),
('local_delivery', 'Local Delivery', 'In-house local delivery service', 'shipping', 'shipping_carrier', ARRAY['*'], ARRAY['*'], 40),
('gig_logistics', 'GIG Logistics', 'Shipping across Nigeria via GIG', 'shipping', 'shipping_carrier', ARRAY['NG'], ARRAY['NGN'], 50),

-- Communication services
('brevo_email', 'Brevo Email', 'Transactional and marketing emails via Brevo', 'communication', 'email_service', ARRAY['*'], ARRAY['*'], 10),
('sendgrid', 'SendGrid Email', 'Email service via SendGrid', 'communication', 'email_service', ARRAY['*'], ARRAY['*'], 20),
('whatsapp_business', 'WhatsApp Business', 'Customer communication via WhatsApp', 'communication', 'messaging_service', ARRAY['*'], ARRAY['*'], 30),

-- Analytics
('google_analytics', 'Google Analytics', 'Website analytics via Google Analytics 4', 'analytics', 'analytics_platform', ARRAY['*'], ARRAY['*'], 10),
('facebook_pixel', 'Facebook Pixel', 'Conversion tracking via Meta Pixel', 'analytics', 'analytics_platform', ARRAY['*'], ARRAY['*'], 20),
('google_merchant', 'Google Merchant Center', 'Product feed for Google Shopping', 'analytics', 'product_feed', ARRAY['*'], ARRAY['*'], 30)

ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description,
    updated_at = now();

-- =====================================================
-- 7. CREATE HELPER FUNCTION TO GET FEATURES FOR BUSINESS TYPE
-- =====================================================

CREATE OR REPLACE FUNCTION get_features_for_business_type(p_business_type TEXT)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    description TEXT,
    feature_category TEXT,
    feature_type TEXT,
    default_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vf.feature_key,
        vf.feature_name,
        vf.description,
        vf.feature_category,
        vf.feature_type,
        vf.default_enabled
    FROM vertical_features vf
    WHERE p_business_type = ANY(vf.business_types)
    AND vf.is_active = true
    ORDER BY vf.feature_category, vf.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 8. CREATE FUNCTION TO INITIALIZE MERCHANT FEATURES ON SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_merchant_features()
RETURNS TRIGGER AS $$
DECLARE
    feature_record RECORD;
    enabled_map JSONB := '{}';
BEGIN
    -- Get default-enabled features for this merchant's business type
    FOR feature_record IN
        SELECT feature_key, default_enabled
        FROM vertical_features
        WHERE NEW.business_type = ANY(business_types)
        AND is_active = true
    LOOP
        enabled_map := enabled_map || jsonb_build_object(feature_record.feature_key, feature_record.default_enabled);
    END LOOP;

    -- Set the enabled_features
    NEW.enabled_features := enabled_map;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new merchants
DROP TRIGGER IF EXISTS trigger_initialize_merchant_features ON merchants;
CREATE TRIGGER trigger_initialize_merchant_features
    BEFORE INSERT ON merchants
    FOR EACH ROW
    WHEN (NEW.enabled_features IS NULL OR NEW.enabled_features = '{}'::jsonb)
    EXECUTE FUNCTION initialize_merchant_features();

-- Add comments
COMMENT ON TABLE vertical_features IS 'Features specific to certain business verticals (e.g., size guide for fashion, IMEI tracking for electronics)';
COMMENT ON TABLE universal_features IS 'Features available to all business types (payment, shipping, analytics providers)';
COMMENT ON TABLE merchant_feature_credentials IS 'Encrypted API credentials for merchant feature integrations';
COMMENT ON FUNCTION get_features_for_business_type IS 'Returns available features for a given business type';
