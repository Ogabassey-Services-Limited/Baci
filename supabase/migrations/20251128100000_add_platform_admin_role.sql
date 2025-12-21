-- Migration: Add platform admin role support
-- Created: 2025-11-28
-- Description: Add is_platform_admin field to merchants table for platform owner access

-- Add is_platform_admin column to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

-- Create partial index for efficient admin lookups (only indexes TRUE values)
CREATE INDEX IF NOT EXISTS idx_merchants_platform_admin
    ON merchants(is_platform_admin)
    WHERE is_platform_admin = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN merchants.is_platform_admin IS 'Flag to identify platform administrators (super admins) who can access admin routes';

-- Set platform owner as admin
UPDATE merchants SET is_platform_admin = TRUE WHERE email = 'basseybjjohn@gmail.com';
