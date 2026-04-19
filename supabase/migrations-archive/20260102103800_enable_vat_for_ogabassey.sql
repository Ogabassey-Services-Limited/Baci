-- Enable VAT for Ogabassey merchant
-- This sets vat_registration_status to 'registered' for the ogabassey store
-- VAT rate is already defaulted to 7.5% in the schema

UPDATE merchants 
SET vat_registration_status = 'registered'
WHERE slug = 'ogabassey';

-- Verify the update
-- SELECT id, business_name, slug, vat_registration_status, vat_rate 
-- FROM merchants 
-- WHERE slug = 'ogabassey';
