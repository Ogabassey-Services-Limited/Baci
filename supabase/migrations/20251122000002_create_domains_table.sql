-- supabase/migrations/20251122000002_create_domains_table.sql

-- Add slug to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add unique index on slug for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS merchants_slug_idx ON merchants (slug);

-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    tld TEXT,
    domain_type TEXT NOT NULL, -- 'subdomain', 'custom', 'purchased'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verifying', 'active', 'failed', 'expired'
    is_primary BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verified_at TIMESTAMPTZ,
    ssl_status TEXT DEFAULT 'pending',
    purchase_info JSONB,
    nameservers JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS domains_merchant_id_idx ON domains (merchant_id);
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Policies for domains table
DROP POLICY IF EXISTS "Merchants can manage their own domains" ON domains;
CREATE POLICY "Merchants can manage their own domains"
ON domains FOR ALL
USING (auth.uid() = (SELECT user_id FROM merchants WHERE id = merchant_id));

-- Function to set a new primary domain and unset old ones
CREATE OR REPLACE FUNCTION set_primary_domain(domain_id_param UUID, merchant_id_param UUID)
RETURNS VOID AS $$
BEGIN
    -- Unset any existing primary domain for the merchant
    UPDATE domains
    SET is_primary = FALSE
    WHERE merchant_id = merchant_id_param AND is_primary = TRUE;

    -- Set the new primary domain
    UPDATE domains
    SET is_primary = TRUE
    WHERE id = domain_id_param;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one primary domain per merchant
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        UPDATE domains
        SET is_primary = FALSE
        WHERE merchant_id = NEW.merchant_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_domain_primary_change ON domains;
CREATE TRIGGER on_domain_primary_change
BEFORE INSERT OR UPDATE ON domains
FOR EACH ROW
EXECUTE FUNCTION ensure_single_primary_domain();
