-- Create domains table for custom domain management
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Domain information
  domain TEXT NOT NULL UNIQUE,
  tld TEXT NOT NULL, -- e.g., '.com', '.com.ng'
  is_primary BOOLEAN DEFAULT true,
  domain_type TEXT NOT NULL CHECK (domain_type IN ('subdomain', 'custom', 'purchased')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'active', 'failed', 'expired')),
  verification_token TEXT,
  verified_at TIMESTAMP,

  -- SSL/DNS status
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
  dns_configured BOOLEAN DEFAULT false,

  -- Purchase information (for purchased domains)
  purchase_info JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "provider": "go54",
  --   "order_id": "...",
  --   "cost_price": 5999,
  --   "sell_price": 8399,
  --   "profit": 2400,
  --   "registered_at": "2025-11-22T00:00:00Z",
  --   "expires_at": "2026-11-22T00:00:00Z",
  --   "auto_renew": true,
  --   "nameservers": ["ns1.whogohost.com", "ns2.whogohost.com"]
  -- }

  -- Nameservers (for custom domains)
  nameservers JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add slug column to merchants table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'slug'
  ) THEN
    ALTER TABLE merchants ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Create function to generate slug from business_name
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(name, '[^\w\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate existing merchants with slugs based on business_name
UPDATE merchants
SET slug = generate_slug(business_name)
WHERE slug IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_domains_merchant_id ON domains(merchant_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_domain_type ON domains(domain_type);
CREATE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);

-- Enable Row Level Security
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for domains table
CREATE POLICY "Merchants can view own domains"
  ON domains FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can insert own domains"
  ON domains FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update own domains"
  ON domains FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete own domains"
  ON domains FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

-- Allow public read access to active domains (for routing)
CREATE POLICY "Public can view active domains"
  ON domains FOR SELECT
  USING (status = 'active');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_domains_updated_at();

-- Trigger to automatically set primary domain
CREATE OR REPLACE FUNCTION set_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first domain for merchant, make it primary
  IF NOT EXISTS (
    SELECT 1 FROM domains
    WHERE merchant_id = NEW.merchant_id
    AND id != NEW.id
  ) THEN
    NEW.is_primary = true;
  END IF;

  -- If setting a domain as primary, unset others
  IF NEW.is_primary = true THEN
    UPDATE domains
    SET is_primary = false
    WHERE merchant_id = NEW.merchant_id
    AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER domains_set_primary
  BEFORE INSERT OR UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION set_primary_domain();

-- Add comment for documentation
COMMENT ON TABLE domains IS 'Stores custom domain configurations for merchant storefronts';
COMMENT ON COLUMN domains.domain_type IS 'subdomain: merchant.baci.tech, custom: bring your own domain, purchased: bought through Go54';
COMMENT ON COLUMN domains.purchase_info IS 'JSON object containing Go54 purchase details, pricing, and expiration info';
