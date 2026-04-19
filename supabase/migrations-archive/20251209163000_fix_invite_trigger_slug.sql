-- Fix: Allow slug to be NULL so Supabase dashboard invites work
-- The trigger creates merchants with NULL slug for new users

ALTER TABLE merchants ALTER COLUMN slug DROP NOT NULL;

-- Add comment explaining this is intentional
COMMENT ON COLUMN merchants.slug IS 'URL-safe slug for subdomain routing - can be NULL for incomplete profiles (new signups, invited users)';
