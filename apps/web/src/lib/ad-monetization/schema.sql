-- Ad Monetization Database Schema for Baci Platform
-- Run this migration to add ad monetization tables

-- ============================================
-- Merchant Ad Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_ad_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Master switch
  enabled BOOLEAN DEFAULT FALSE,

  -- Ad network credentials (encrypted in production)
  network_code TEXT, -- Google Ad Manager Network Code
  adsense_id TEXT, -- ca-pub-XXXXXXXXXXXXXXXX
  provider TEXT DEFAULT 'adsense' CHECK (provider IN ('google_ad_manager', 'adsense', 'both')),

  -- Revenue sharing
  revenue_share_percent DECIMAL(5,2) DEFAULT 30.00,

  -- Test mode
  test_mode BOOLEAN DEFAULT TRUE,

  -- Ad density settings
  max_ads_per_page INTEGER DEFAULT 5,
  min_content_between_ads INTEGER DEFAULT 300, -- pixels

  -- Analytics flags
  track_impressions BOOLEAN DEFAULT TRUE,
  track_clicks BOOLEAN DEFAULT TRUE,

  -- Compliance flags
  gdpr_compliant BOOLEAN DEFAULT TRUE,
  ccpa_compliant BOOLEAN DEFAULT TRUE,
  show_ad_labels BOOLEAN DEFAULT TRUE,

  -- Subscription tier for ad feature
  ad_tier TEXT DEFAULT 'starter' CHECK (ad_tier IN ('starter', 'growth', 'pro', 'enterprise')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id)
);

-- ============================================
-- Ad Placement Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Placement identification
  placement_key TEXT NOT NULL,

  -- Settings
  enabled BOOLEAN DEFAULT FALSE,
  custom_ad_unit_id TEXT, -- Override default ad unit
  custom_sizes JSONB, -- Array of [width, height] tuples
  frequency INTEGER DEFAULT 1, -- For in-feed ads: show every N items

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id, placement_key)
);

-- ============================================
-- Rewarded Ad Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_rewarded_ad_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Settings
  enabled BOOLEAN DEFAULT FALSE,
  reward_type TEXT DEFAULT 'discount_percent' CHECK (reward_type IN ('discount_percent', 'discount_fixed', 'loyalty_points', 'free_shipping')),
  reward_value DECIMAL(10,2) DEFAULT 5.00, -- 5% or ₦500
  reward_expiry_days INTEGER DEFAULT 30, -- 0 = never expires
  min_order_value DECIMAL(10,2), -- Minimum order to show ad

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id)
);

-- ============================================
-- Ad Impressions Table (for analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Ad identification
  placement_key TEXT NOT NULL,
  ad_unit_id TEXT NOT NULL,

  -- Context
  page_url TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet')),
  viewable_time INTEGER, -- seconds the ad was viewable

  -- Session/user context (anonymized)
  session_id TEXT,
  country_code TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Ad Clicks Table
-- ============================================
CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  impression_id UUID REFERENCES ad_impressions(id) ON DELETE SET NULL,

  -- Ad identification
  placement_key TEXT NOT NULL,
  ad_unit_id TEXT NOT NULL,

  -- Context
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet')),

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Daily Ad Revenue Table (aggregated)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_revenue_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0, -- Click-through rate (0.0000 - 1.0000)
  rpm DECIMAL(10,4) DEFAULT 0, -- Revenue per 1000 impressions

  -- Revenue breakdown
  gross_revenue DECIMAL(12,2) DEFAULT 0,
  platform_fee DECIMAL(12,2) DEFAULT 0,
  net_revenue DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'NGN',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(merchant_id, date)
);

-- ============================================
-- Rewarded Ad Rewards Table (tracking earned rewards)
-- ============================================
CREATE TABLE IF NOT EXISTS rewarded_ad_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Reward details
  reward_type TEXT NOT NULL,
  reward_value DECIMAL(10,2) NOT NULL,

  -- Status
  status TEXT DEFAULT 'earned' CHECK (status IN ('earned', 'applied', 'expired', 'cancelled')),
  applied_to_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Expiry
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Ad settings indexes
CREATE INDEX IF NOT EXISTS idx_merchant_ad_settings_merchant ON merchant_ad_settings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_ad_placements_merchant ON merchant_ad_placements(merchant_id);

-- Impression/click indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ad_impressions_merchant_date ON ad_impressions(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_placement ON ad_impressions(placement_key, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_merchant_date ON ad_clicks(merchant_id, created_at);

-- Revenue indexes
CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_merchant_date ON ad_revenue_daily(merchant_id, date);

-- Rewards indexes
CREATE INDEX IF NOT EXISTS idx_rewarded_ad_rewards_customer ON rewarded_ad_rewards(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_rewarded_ad_rewards_merchant ON rewarded_ad_rewards(merchant_id, created_at);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE merchant_ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_rewarded_ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_revenue_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewarded_ad_rewards ENABLE ROW LEVEL SECURITY;

-- Merchants can only see their own ad settings
CREATE POLICY merchant_ad_settings_policy ON merchant_ad_settings
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY merchant_ad_placements_policy ON merchant_ad_placements
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY merchant_rewarded_ad_settings_policy ON merchant_rewarded_ad_settings
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Analytics data policy
CREATE POLICY ad_impressions_policy ON ad_impressions
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY ad_clicks_policy ON ad_clicks
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY ad_revenue_daily_policy ON ad_revenue_daily
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY rewarded_ad_rewards_policy ON rewarded_ad_rewards
  FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ============================================
-- Triggers for Updated Timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_ad_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_merchant_ad_settings_timestamp
  BEFORE UPDATE ON merchant_ad_settings
  FOR EACH ROW EXECUTE FUNCTION update_ad_settings_timestamp();

CREATE TRIGGER update_merchant_ad_placements_timestamp
  BEFORE UPDATE ON merchant_ad_placements
  FOR EACH ROW EXECUTE FUNCTION update_ad_settings_timestamp();

CREATE TRIGGER update_merchant_rewarded_ad_settings_timestamp
  BEFORE UPDATE ON merchant_rewarded_ad_settings
  FOR EACH ROW EXECUTE FUNCTION update_ad_settings_timestamp();

CREATE TRIGGER update_ad_revenue_daily_timestamp
  BEFORE UPDATE ON ad_revenue_daily
  FOR EACH ROW EXECUTE FUNCTION update_ad_settings_timestamp();
