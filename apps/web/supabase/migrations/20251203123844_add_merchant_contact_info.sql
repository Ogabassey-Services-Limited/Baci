-- Add contact info fields to merchants table for footer display
-- These fields allow merchants to provide customer support contact details

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS support_email TEXT,
    ADD COLUMN IF NOT EXISTS support_phone TEXT,
    ADD COLUMN IF NOT EXISTS business_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN merchants.support_email IS 'Customer support email address displayed in storefront footer';
COMMENT ON COLUMN merchants.support_phone IS 'Customer support phone number displayed in storefront footer';
COMMENT ON COLUMN merchants.business_address IS 'Business address displayed in storefront footer';
