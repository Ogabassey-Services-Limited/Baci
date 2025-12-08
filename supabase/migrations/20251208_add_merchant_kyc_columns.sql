-- Add KYC columns to merchants table
-- These store self-declared verification data pending manual review

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS nin TEXT,
ADD COLUMN IF NOT EXISTS bvn TEXT,
ADD COLUMN IF NOT EXISTS cac_number TEXT,
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected'));

-- Add index for KYC status queries (admin dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_merchants_kyc_status ON merchants(kyc_status);

-- Comment for documentation
COMMENT ON COLUMN merchants.nin IS 'National Identification Number (11 digits) - self-declared';
COMMENT ON COLUMN merchants.bvn IS 'Bank Verification Number (11 digits) - self-declared';
COMMENT ON COLUMN merchants.cac_number IS 'Corporate Affairs Commission registration number';
COMMENT ON COLUMN merchants.kyc_status IS 'KYC verification status: pending, verified, rejected';
