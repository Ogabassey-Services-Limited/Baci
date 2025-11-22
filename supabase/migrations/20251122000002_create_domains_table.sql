-- =============================================
-- DOMAINS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    tld TEXT,
    domain_type TEXT NOT NULL, -- 'subdomain', 'custom', 'purchased'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verifying', 'active', 'failed', 'expired'
    is_primary BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_token_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    ssl_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'failed'
    purchase_info JSONB,
    nameservers JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        -- If status is 'pending' or 'verifying', verification_token must not be NULL
        (status IN ('pending', 'verifying') AND verification_token IS NOT NULL AND verification_token_expires_at IS NOT NULL)
        OR
        (status NOT IN ('pending', 'verifying'))
    )
);

-- Add comments to columns
COMMENT ON COLUMN domains.domain_type IS 'Type of domain: subdomain (e.g., store.baci.tech), custom (e.g., mystore.com), or purchased (bought via Baci)';
COMMENT ON COLUMN domains.status IS 'Current status of the domain configuration';
COMMENT ON COLUMN domains.is_primary IS 'Whether this is the primary domain for the storefront';
COMMENT ON COLUMN domains.ssl_status IS 'Status of the SSL certificate for this domain';
COMMENT ON COLUMN domains.purchase_info IS 'Stores details if the domain was purchased through Baci';

-- Add indexes
CREATE INDEX IF NOT EXISTS domains_merchant_id_idx ON domains (merchant_id);
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);
CREATE UNIQUE INDEX IF NOT EXISTS domains_lower_domain_idx ON domains (LOWER(domain));

-- Partial unique index to ensure at most one primary domain per merchant
CREATE UNIQUE INDEX IF NOT EXISTS domains_one_primary_per_merchant_idx ON domains (merchant_id) WHERE is_primary = TRUE;

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================
-- Policy: Merchants can view their own domains
CREATE POLICY "Allow merchants to view their own domains"
ON domains FOR SELECT
USING (auth.uid() = (SELECT user_id FROM merchants WHERE id = merchant_id));

-- Policy: Merchants can insert domains for their own merchant record
CREATE POLICY "Allow merchants to insert their own domains"
ON domains FOR INSERT
WITH CHECK (auth.uid() = (SELECT user_id FROM merchants WHERE id = merchant_id));

-- Policy: Merchants can update their own domains
CREATE POLICY "Allow merchants to update their own domains"
ON domains FOR UPDATE
USING (auth.uid() = (SELECT user_id FROM merchants WHERE id = merchant_id));

-- Policy: Merchants can delete their own domains
CREATE POLICY "Allow merchants to delete their own domains"
ON domains FOR DELETE
USING (auth.uid() = (SELECT user_id FROM merchants WHERE id = merchant_id));


-- =============================================
-- TRIGGERS & FUNCTIONS
-- =============================================
-- Function to set a domain as primary and unset others
CREATE OR REPLACE FUNCTION set_primary_domain(domain_id_param UUID, merchant_id_param UUID)
RETURNS VOID AS $$
BEGIN
    -- First, unset any other primary domain for this merchant
    UPDATE domains
    SET is_primary = FALSE
    WHERE merchant_id = merchant_id_param AND is_primary = TRUE;

    -- Set the new primary domain, ONLY if it belongs to the given merchant
    UPDATE domains
    SET is_primary = TRUE
    WHERE id = domain_id_param AND merchant_id = merchant_id_param;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_domains_update
    BEFORE UPDATE ON domains
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Trigger to ensure only one primary domain per merchant (alternative to partial index for some PG versions)
-- The partial index is preferred, but this is a fallback. We'll rely on the index.
-- CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.is_primary = TRUE THEN
--         UPDATE domains
--         SET is_primary = FALSE
--         WHERE merchant_id = NEW.merchant_id AND id <> NEW.id AND is_primary = TRUE;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER enforce_single_primary
--     BEFORE INSERT OR UPDATE ON domains
--     FOR EACH ROW
--     EXECUTE FUNCTION ensure_single_primary_domain();

-- Function to execute arbitrary SQL (for migrations from JS)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;
