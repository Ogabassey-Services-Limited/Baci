-- Migration: Add public read policy for domains table
-- Description: Allow anonymous users to read active domains for custom domain routing
-- Created: 2025-12-15
-- Issue: Custom domain routing fails because RLS blocks anon reads from domains table

-- Add policy for public/anon access to active domains
-- This is required for the storefront to look up merchants by custom domain
CREATE POLICY "Anyone can read active domains"
ON domains
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Add comment
COMMENT ON POLICY "Anyone can read active domains" ON domains IS
'Allow public read access to active domains for custom domain routing in storefronts';
