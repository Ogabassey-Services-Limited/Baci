-- Add FIRS e-Invoice integration fields to merchants table
-- These fields are required for merchants to submit invoices to the
-- Federal Inland Revenue Service (FIRS) Nigeria Revenue Service portal

-- FIRS entity/service identifiers
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_business_id UUID;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_service_id VARCHAR(8);

-- FIRS RSA public key and certificate for invoice signing/QR codes
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_public_key TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_certificate TEXT;

-- FIRS portal credentials (encrypted)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_email TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firs_password_encrypted TEXT;

-- Structured location codes for FIRS postal address requirements
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS lga_code VARCHAR(20);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_merchants_firs_business_id ON merchants (firs_business_id) WHERE firs_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchants_firs_service_id ON merchants (firs_service_id) WHERE firs_service_id IS NOT NULL;

-- RLS: merchants can only read/update their own FIRS fields
-- (Existing RLS policies on merchants table already enforce this via merchant_id = auth.uid())
-- No additional policies needed since the merchants table already has row-level access control
