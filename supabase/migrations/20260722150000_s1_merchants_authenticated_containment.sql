-- ============================================================================
-- S1: public.merchants AUTHENTICATED containment (records prod drift)
-- ============================================================================
-- Closes the authenticated-role cross-tenant P0. Prior live state: policy
-- "Authenticated can view merchants" USING (true) + a table-wide grant let ANY
-- signed-in customer read every merchant's bvn/nin/bank/stripe/marketing tokens.
-- Writes are already owner/staff-scoped (the DELETE/INSERT/UPDATE policies use
-- user_id = auth.uid() / active-staff checks), so only the SELECT side leaked.
--
-- DRIFT NOTE: this containment was applied directly to prod during an incident
-- (2026-07-23) and is not yet recorded in a migration. This file records it so a
-- baseline replay reproduces the same end state. Every statement below is a
-- no-op against current prod (already applied) and re-runnable.
--
-- INCIDENT CONTEXT (why writes are re-granted here): the direct prod apply used
-- REVOKE ALL, which also stripped INSERT/UPDATE/DELETE and broke owner/staff
-- settings-saves (updateMerchant runs on the authenticated browser client). The
-- writes were restored on prod and are re-granted here so a replay never loses
-- them. Writes stay owner/staff-scoped by the row policies -- re-granting the
-- table privilege reopens NO cross-tenant hole.
--
-- READER-MIGRATION PREREQUISITE (this PR): a SET ROLE sweep + an exhaustive grep
-- of every merchants read of the incident-bridge columns found authenticated-
-- client reads of two genuinely-secret payment columns that #3112 did NOT move --
-- paystack_subaccount_code (merchant publish/readiness, paystack subaccount setup,
-- and customer wallet/order-funding/savings via resolve-wallet-top-up-merchant's
-- callers) and virtual_terminal_code (paystack virtual-terminal route + local
-- sync). This PR moves all of them onto the service-role admin client. Because the
-- deploy pipeline runs db-migrations BEFORE the Vercel deploy, those two columns
-- remain GRANTED on prod from the incident hotfix (they are omitted from the grant
-- list below) and are revoked in a SEPARATE follow-up migration only AFTER this
-- PR's reader-move code is live in prod (2-phase expand/contract).
--
-- is_platform_admin: DELIBERATELY KEPT GRANTED (this list, below). It is an
-- authorization boolean, not a financial/PII secret, and is read by the shared
-- getPlatformAdminAuth() helper + ~15 admin routes as a self-scoped admin gate on
-- the authenticated client. Containing it (mirroring anon, which omits it) would
-- break the admin panel; proper containment (move those readers to admin) is a
-- deferred follow-up. This is the one intentional divergence from anon's 77 cols.
--
-- The grant mirrors the anon column set (77) PLUS is_platform_admin. The financial
-- secrets kept off this list: bvn, nin, cac_number, firs_public_key,
-- firs_certificate, firs_email, firs_password_encrypted, stripe_customer_id,
-- stripe_subscription_id, facebook_capi_token, facebook_capi_access_token,
-- tiktok_access_token, snapchat_capi_token, ga4_api_secret,
-- google_product_sheet_url (+ paystack_subaccount_code, virtual_terminal_code,
-- revoked later in the follow-up once their readers are on the admin client).
--
-- Idempotent (REVOKE/GRANT/ALTER POLICY re-runnable) and wrapped in one txn.
-- ============================================================================

BEGIN;

-- (a) Drop the table-level SELECT ONLY. The authenticated role has legitimate
--     owner/staff writes to merchants, already scoped by the DELETE/INSERT/UPDATE
--     row policies -- those are NOT the cross-tenant hole. Revoke only the read
--     grant here; the column GRANT SELECT in (d) becomes the effective read
--     surface (a table-level SELECT is not overridden by a column grant, so the
--     table SELECT must be revoked first). TRUNCATE/REFERENCES/TRIGGER in any
--     legacy GRANT ALL are not reachable via PostgREST and are left untouched.
REVOKE SELECT ON TABLE public.merchants FROM authenticated;

-- (b) Re-assert the owner/staff writes. Defensive against a prior REVOKE ALL
--     (see incident note) -- idempotent when the privileges already exist. These
--     stay owner/staff-scoped by the row policies, so this reopens no read hole.
GRANT INSERT, UPDATE, DELETE ON TABLE public.merchants TO authenticated;

-- (c) Tighten the row policy from USING (true) to: own row OR published OR a
--     merchant this user actively staffs. Closes draft-store PII enumeration by
--     arbitrary signed-in users. IS TRUE so a NULL is_published row is excluded.
ALTER POLICY "Authenticated can view merchants"
  ON public.merchants
  USING (
    user_id = (SELECT auth.uid())
    OR is_published IS TRUE
    OR EXISTS (
      SELECT 1 FROM public.staff_members s
      WHERE s.user_id = (SELECT auth.uid())
        AND s.merchant_id = merchants.id
        AND s.status = 'active'
    )
  );

-- (d) Grant back the same non-secret columns anon has (77). user_id is required
--     because the {public} RLS policies on public.domains and
--     public.merchant_feature_settings subquery merchants.user_id, which is
--     evaluated with the caller's privileges (42501 without it).
GRANT SELECT (
  about_page, bank_account_name, bank_account_number, bank_code, bank_name,
  brand_colors, business_address, business_name, business_type, cac_rc_number,
  country, created_at, email, email_domain, email_domain_verified,
  email_logo_url, email_sender_name, endpoint_id, endpoint_scheme_id,
  facebook_pixel_id, faq_items, favicon_apple_touch_url, favicon_png_192_url,
  favicon_png_32_url, favicon_svg_url, favicon_uploaded_at, feature_settings,
  firs_business_id, firs_service_id, gmc_variants_enabled, google_analytics_id,
  hero_image_ids, hero_images_generated_at, hero_images_regeneration_count,
  hero_slides, id, is_platform_admin, is_published, kyc_status,
  legal_entity_name, lga_code,
  logo_url, mobile_hero_slides, multi_currency_enabled,
  offline_conversions_enabled, order_prefix, pages, payout_currency, phone,
  plan_expires_at, plan_started_at, plan_tier, premium_features, published_at,
  published_config, registered_address, rider_phone_number,
  self_fulfillment_enabled, signup_source, site_description, site_tagline,
  site_title, slug, snapchat_pixel_id, social_media, state_code, support_email,
  support_phone, tax_exempt, tax_identification_number, template_id,
  tiktok_pixel_id, trust_profile, twitter_pixel_id, updated_at, user_id,
  vat_rate, vat_registration_status
) ON public.merchants TO authenticated;

COMMIT;
