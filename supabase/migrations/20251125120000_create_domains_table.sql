-- Migration: Create domains table for custom domain management
-- Description: Supports subdomain, custom domain (BYOD), and purchased domains
-- Created: 2024-11-25

-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    tld TEXT NOT NULL, -- .com, .ng, .com.ng, etc.
    domain_type TEXT NOT NULL CHECK (domain_type IN ('subdomain', 'custom', 'purchased')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'expired', 'failed')),
    is_primary BOOLEAN DEFAULT FALSE,

    -- Verification (for custom/BYOD domains)
    verification_token TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Purchase details (for Go54 purchased domains)
    go54_order_id TEXT,
    purchase_price DECIMAL(10, 2),
    renewal_price DECIMAL(10, 2),

    -- Dates
    registered_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT TRUE,

    -- DNS & SSL
    nameservers TEXT[], -- Array of nameserver addresses
    ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
    ssl_issued_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_domains_merchant_id ON domains(merchant_id);
CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_domains_is_primary ON domains(merchant_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_domains_expires_at ON domains(expires_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own domains
CREATE POLICY "Merchants can view their own domains"
ON domains
FOR SELECT
TO authenticated
USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Policy: Merchants can insert their own domains
CREATE POLICY "Merchants can create domains"
ON domains
FOR INSERT
TO authenticated
WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Policy: Merchants can update their own domains
CREATE POLICY "Merchants can update their own domains"
ON domains
FOR UPDATE
TO authenticated
USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Policy: Merchants can delete their own domains
CREATE POLICY "Merchants can delete their own domains"
ON domains
FOR DELETE
TO authenticated
USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_domains_updated_at
    BEFORE UPDATE ON domains
    FOR EACH ROW
    EXECUTE FUNCTION update_domains_updated_at();

-- Trigger to ensure only one primary domain per merchant
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        -- Unset is_primary for all other domains of this merchant
        UPDATE domains
        SET is_primary = FALSE
        WHERE merchant_id = NEW.merchant_id
        AND id != NEW.id
        AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_domain_trigger
    BEFORE INSERT OR UPDATE ON domains
    FOR EACH ROW
    WHEN (NEW.is_primary = TRUE)
    EXECUTE FUNCTION ensure_single_primary_domain();

-- Add comments for documentation
COMMENT ON TABLE domains IS 'Custom domains and subdomains for merchant storefronts';
COMMENT ON COLUMN domains.domain_type IS 'subdomain (free .usebaci.com), custom (BYOD), or purchased (via Go54)';
COMMENT ON COLUMN domains.status IS 'pending (awaiting verification), active (live), inactive (disabled), expired (needs renewal), failed (error)';
COMMENT ON COLUMN domains.verification_token IS 'Token for DNS TXT record verification (_baci-verification)';
COMMENT ON COLUMN domains.go54_order_id IS 'Go54 API order ID for purchased domains';
COMMENT ON COLUMN domains.auto_renew IS 'Automatically renew domain before expiration';
COMMENT ON COLUMN domains.is_primary IS 'Primary domain shown in merchant dashboard and used for canonical URLs';
