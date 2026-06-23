-- Dark-mode-safe transactional email logo.
--
-- The Gmail mobile app force-applies dark-mode inversion and ignores
-- `color-scheme` / `forced-color-adjust` / `prefers-color-scheme`, so a
-- transparent logo rendered on a white CSS chip gets darkened and the dark
-- wordmark lands black-on-black. A fully OPAQUE image (white plate baked into
-- the pixels, no alpha channel) stays readable because Gmail never inverts the
-- pixels *inside* an image. When set, transactional emails render this directly
-- with no chip; when null they fall back to `logo_url` shown on a white chip.
--
-- Data-driven replacement for the previously hardcoded per-merchant asset path
-- in the receipt email (import-notification-email-content.ts) and the
-- send-auth-email edge function.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS email_logo_url text;

COMMENT ON COLUMN public.merchants.email_logo_url IS
  'Optional fully-opaque logo (white plate baked in, no alpha channel) for transactional emails. Dark-mode-inverting clients (Gmail app) ignore CSS chip hardening; an opaque image stays readable. When set, emails render it directly with no white chip; when null they fall back to logo_url on a chip.';

-- Seed the existing opaque asset for Ogabassey (previously hardcoded in code).
UPDATE public.merchants
  SET email_logo_url = 'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-email-logo-2026-v1.png'
  WHERE slug = 'ogabassey'
    AND email_logo_url IS NULL;
