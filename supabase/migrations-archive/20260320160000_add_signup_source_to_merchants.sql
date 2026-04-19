-- Migration: Add signup_source column to merchants
-- Date: 2026-03-20
-- Purpose:
--   Track which platform (web, ios, android) each merchant signed up from.
--   Enables signup-by-channel analytics in the admin dashboard.

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'web'
CHECK (signup_source IN ('web', 'ios', 'android'));

COMMENT ON COLUMN public.merchants.signup_source IS
  'Platform the merchant signed up from: web, ios, or android. Set during onboarding.';

-- Partial index for admin dashboard analytics — only non-admin merchants matter
CREATE INDEX IF NOT EXISTS idx_merchants_signup_source
  ON public.merchants (signup_source)
  WHERE is_platform_admin = FALSE OR is_platform_admin IS NULL;
