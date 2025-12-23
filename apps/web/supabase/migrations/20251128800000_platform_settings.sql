-- Platform Settings Table
-- Stores configuration for the platform owner (you), separate from merchant settings
-- This includes analytics pixels, fees, and other platform-wide settings

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Only one row should exist - this is a singleton table
    singleton_key BOOLEAN DEFAULT TRUE UNIQUE CHECK (singleton_key = TRUE),

    -- Platform Analytics
    google_analytics_id VARCHAR(50),           -- G-XXXXXXXXXX
    ga4_api_secret VARCHAR(100),               -- Measurement Protocol secret
    facebook_pixel_id VARCHAR(50),             -- Platform FB Pixel
    facebook_capi_token TEXT,                  -- Platform FB CAPI token
    tiktok_pixel_id VARCHAR(50),               -- Platform TikTok Pixel
    tiktok_access_token TEXT,                  -- Platform TikTok Events API
    snapchat_pixel_id VARCHAR(50),             -- Platform Snapchat Pixel
    snapchat_capi_token TEXT,                  -- Platform Snapchat CAPI
    twitter_pixel_id VARCHAR(50),              -- Platform Twitter Pixel

    -- Platform Fees
    platform_fee_percentage DECIMAL(5,2) DEFAULT 0.00,  -- e.g., 2.50 for 2.5%
    platform_fee_flat DECIMAL(10,2) DEFAULT 0.00,       -- Flat fee per transaction
    payment_processor_fee_percentage DECIMAL(5,2) DEFAULT 1.50,  -- Korapay/Paystack fee
    payment_processor_fee_flat DECIMAL(10,2) DEFAULT 100.00,     -- Flat processor fee (NGN)

    -- Platform Branding (for white-label future)
    platform_name VARCHAR(100) DEFAULT 'Baci',
    platform_logo_url TEXT,
    support_email VARCHAR(255),
    support_phone VARCHAR(50),

    -- Feature Flags
    enable_merchant_signups BOOLEAN DEFAULT TRUE,
    enable_custom_domains BOOLEAN DEFAULT TRUE,
    enable_analytics_export BOOLEAN DEFAULT TRUE,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    maintenance_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on singleton key
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_settings_singleton ON public.platform_settings(singleton_key);

-- Insert default row (singleton pattern)
INSERT INTO public.platform_settings (singleton_key)
VALUES (TRUE)
ON CONFLICT (singleton_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read settings
CREATE POLICY "Platform admins can read settings"
    ON public.platform_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants
            WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
    );

-- Only platform admins can update settings
CREATE POLICY "Platform admins can update settings"
    ON public.platform_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants
            WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchants
            WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
    );

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_platform_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_platform_settings_updated ON public.platform_settings;
CREATE TRIGGER trigger_platform_settings_updated
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_platform_settings_timestamp();

-- Platform Events Table (tracks platform-level events separate from merchant events)
CREATE TABLE IF NOT EXISTS public.platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',

    -- Optional references
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    user_id UUID,

    -- Tracking
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address VARCHAR(45),
    referrer TEXT,
    page_url TEXT,

    -- Timestamps
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for platform events
CREATE INDEX IF NOT EXISTS idx_platform_events_type ON public.platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_timestamp ON public.platform_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_merchant ON public.platform_events(merchant_id);

-- Enable RLS on platform events
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read platform events
CREATE POLICY "Platform admins can read platform events"
    ON public.platform_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants
            WHERE user_id = auth.uid()
            AND is_platform_admin = TRUE
        )
    );

-- Service role can insert platform events (from API routes)
CREATE POLICY "Service role can insert platform events"
    ON public.platform_events
    FOR INSERT
    TO service_role
    WITH CHECK (TRUE);

-- Also allow anon to insert (for landing page tracking before login)
CREATE POLICY "Anyone can insert platform events"
    ON public.platform_events
    FOR INSERT
    WITH CHECK (TRUE);

-- Platform Revenue View (calculates platform revenue from fees)
CREATE OR REPLACE VIEW public.platform_revenue AS
SELECT
    DATE(o.created_at) as date,
    COUNT(*) as total_orders,
    SUM(o.total) as gross_gmv,
    -- Calculate platform fees
    SUM(
        COALESCE(
            (SELECT platform_fee_percentage FROM public.platform_settings LIMIT 1), 0
        ) / 100 * o.total +
        COALESCE(
            (SELECT platform_fee_flat FROM public.platform_settings LIMIT 1), 0
        )
    ) as platform_fees,
    -- Calculate payment processor fees
    SUM(
        COALESCE(
            (SELECT payment_processor_fee_percentage FROM public.platform_settings LIMIT 1), 1.5
        ) / 100 * o.total +
        COALESCE(
            (SELECT payment_processor_fee_flat FROM public.platform_settings LIMIT 1), 100
        )
    ) as processor_fees,
    -- Net to merchants
    SUM(o.total) - SUM(
        COALESCE(
            (SELECT platform_fee_percentage FROM public.platform_settings LIMIT 1), 0
        ) / 100 * o.total +
        COALESCE(
            (SELECT platform_fee_flat FROM public.platform_settings LIMIT 1), 0
        )
    ) as net_to_merchants
FROM public.orders o
WHERE o.payment_status = 'paid'
GROUP BY DATE(o.created_at)
ORDER BY date DESC;

-- Grant permissions
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT ON public.platform_events TO anon, authenticated;
GRANT ALL ON public.platform_events TO service_role;
GRANT SELECT ON public.platform_revenue TO authenticated;

COMMENT ON TABLE public.platform_settings IS 'Singleton table for platform-wide settings including analytics, fees, and feature flags';
COMMENT ON TABLE public.platform_events IS 'Platform-level event tracking (signups, landing page visits, etc.)';
COMMENT ON VIEW public.platform_revenue IS 'Calculates platform revenue from fees on completed orders';
