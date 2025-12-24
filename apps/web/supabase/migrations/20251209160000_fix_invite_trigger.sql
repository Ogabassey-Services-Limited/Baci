-- Fix: Allow business_name to be NULL so Supabase dashboard invites work
-- The handle_new_user trigger creates merchants with NULL business_name for new users
-- This was blocking team member invitations to the Supabase dashboard

ALTER TABLE merchants ALTER COLUMN business_name DROP NOT NULL;

-- Add comment explaining this is intentional
COMMENT ON COLUMN merchants.business_name IS 'Business name - can be NULL for incomplete profiles (new signups, invited users)';
