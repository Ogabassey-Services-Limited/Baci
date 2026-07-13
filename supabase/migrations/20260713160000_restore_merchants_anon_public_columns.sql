-- ============================================================================
-- HOTFIX: restore anon SELECT on public.merchants presentation/config columns
-- ============================================================================
-- The S0-A containment migration (20260713150000) revoked the anon table grant
-- and granted back only a hand-verified subset of columns. That allow-list was
-- INCOMPLETE: it omitted ~30 non-secret columns that public storefront/blog/OG
-- paths actually read. Postgres reports `42501 permission denied for table
-- merchants` (NOT "column") when a SELECT touches any ungranted column, so any
-- public query naming one of them failed entirely — the confirmed trigger was
-- the blog prerender reading `feature_settings`. This broke every repo-wide
-- build (prerender queries prod as anon) and blocked all deploys.
--
-- Root cause of the miss: S0-A was validated with has_column_privilege() + a few
-- sample selects, never the real blog/storefront prerender queries. Lesson: for
-- a column-grant migration, run the actual app queries under SET ROLE anon.
--
-- This migration grants back every remaining NON-SECRET column. After it, the
-- ONLY columns anon cannot read are the 18 confirmed secrets (kept revoked
-- below for the record) — so no public reader can be missing by construction.
--
-- Applied to prod as a hotfix on 2026-07-13 (identical GRANT); this file records
-- it. GRANT is idempotent, so re-applying via the migration runner is a no-op.
--
-- STILL REVOKED FROM anon (intentional, do NOT grant): bvn, nin, cac_number,
-- firs_public_key, firs_certificate, firs_email, firs_password_encrypted,
-- facebook_capi_token, facebook_capi_access_token, tiktok_access_token,
-- snapchat_capi_token, ga4_api_secret, stripe_customer_id, stripe_subscription_id,
-- paystack_subaccount_code (routed via storefront_merchant_has_paystack_subaccount
-- RPC), virtual_terminal_code, is_platform_admin, google_product_sheet_url.
-- ============================================================================

GRANT SELECT (
  -- storefront pages / presentation
  about_page, faq_items, trust_profile, email_logo_url,
  hero_images_generated_at, hero_images_regeneration_count, order_prefix,
  -- feature/config flags (feature_settings drives blog_enabled etc.)
  feature_settings, multi_currency_enabled, self_fulfillment_enabled,
  gmc_variants_enabled, offline_conversions_enabled, tax_exempt,
  -- public analytics measurement IDs (embedded in storefront HTML; not secrets)
  google_analytics_id, facebook_pixel_id, tiktok_pixel_id,
  snapchat_pixel_id, twitter_pixel_id,
  -- sending domain + location (public)
  email_domain, email_domain_verified, lga_code, state_code,
  -- FIRS e-invoicing registration identifiers (not credentials)
  endpoint_id, endpoint_scheme_id, firs_business_id, firs_service_id,
  -- non-sensitive lifecycle metadata
  created_at, plan_started_at, signup_source, kyc_status
) ON public.merchants TO anon;
