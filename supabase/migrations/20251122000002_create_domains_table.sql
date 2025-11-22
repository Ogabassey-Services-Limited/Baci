-- =============================================
-- MERCHANTS TABLE - ADD SLUG
-- =============================================
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Trigger to generate slug from business_name
CREATE OR REPLACE FUNCTION generate_merchant_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.business_name, E'[^\\w]+', '-', 'g'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS set_merchant_slug ON merchants;
CREATE TRIGGER set_merchant_slug
BEFORE INSERT OR UPDATE ON merchants
FOR EACH ROW
WHEN (NEW.business_name IS NOT NULL)
EXECUTE FUNCTION generate_merchant_slug();


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
    ssl_status TEXT DEFAULT 'pending',
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

-- Add indexes
CREATE INDEX IF NOT EXISTS domains_merchant_id_idx ON domains (merchant_id);
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);
CREATE UNIQUE INDEX IF NOT EXISTS domains_lower_domain_idx ON domains (LOWER(domain));

-- Partial unique index to ensure at most one primary domain per merchant
CREATE UNIQUE INDEX IF NOT EXISTS domains_one_primary_per_merchant_idx ON domains (merchant_id) WHERE is_primary = TRUE;

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Policies for domains table
CREATE POLICY "Allow merchants to view their own domains"
ON domains
FOR SELECT
USING (
  (SELECT auth.uid()) = (SELECT user_id FROM merchants WHERE id = merchant_id)
);

CREATE POLICY "Allow merchants to insert their own domains"
ON domains
FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) = (SELECT user_id FROM merchants WHERE id = merchant_id)
);

CREATE POLICY "Allow merchants to update their own domains"
ON domains
FOR UPDATE
USING (
  (SELECT auth.uid()) = (SELECT user_id FROM merchants WHERE id = merchant_id)
);

CREATE POLICY "Allow merchants to delete their own domains"
ON domains
FOR DELETE
USING (
  (SELECT auth.uid()) = (SELECT user_id FROM merchants WHERE id = merchant_id)
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to set a primary domain for a merchant
CREATE OR REPLACE FUNCTION set_primary_domain(merchant_id_param UUID, domain_id_param UUID)
RETURNS void AS $$
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

-- Trigger function to ensure only one primary domain per merchant
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        PERFORM set_primary_domain(NEW.merchant_id, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle primary domain setting
DROP TRIGGER IF EXISTS on_domain_primary_change ON domains;
CREATE TRIGGER on_domain_primary_change
AFTER INSERT OR UPDATE ON domains
FOR EACH ROW
WHEN (NEW.is_primary = TRUE)
EXECUTE FUNCTION ensure_single_primary_domain();
