-- Extend categories public-read policy to cover authenticated storefront customers.
--
-- Background: the storefront client uses the user's JWT once they sign in,
-- which switches PostgREST from `anon` to `authenticated`. The existing
-- `categories_public_read` policy only granted SELECT to `anon`, while the
-- only `authenticated` policy (`categories_merchant_policy`) restricts rows
-- to the merchant owner. Result: signed-in customers saw zero categories
-- and the storefront filter rendered only the "All" pill.
--
-- Fix: re-create `categories_public_read` so it applies to both roles. The
-- `is_active = true` filter is preserved, matching the original intent of a
-- public read of active categories.

DROP POLICY IF EXISTS categories_public_read ON public.categories;

CREATE POLICY categories_public_read
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
