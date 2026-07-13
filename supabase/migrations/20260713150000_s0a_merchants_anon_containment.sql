-- ============================================================================
-- S0-A: public.merchants anon containment bridge
-- ============================================================================
-- Closes a LIVE P0. The anon PostgREST role currently holds GRANT ALL +
-- a SELECT policy USING (true) on public.merchants, so anyone holding the public
-- anon key can read (and nominally write) every column of every merchant row,
-- including bank_account_number, bvn, nin, and paystack_subaccount_code.
--
-- Prod probe (2026-07-13, read-only): 75 merchants — 15 published, 60 unpublished
-- (every unpublished row with products/orders is a draft/test/e2e/audit fixture,
-- so the is_published predicate strands zero real serving stores). Live sensitive
-- data actually present: 13 bank accounts, 12 paystack codes, 3 NIN, 2 BVN,
-- 1 platform-admin flag. All API-token columns (ga4/fb/tiktok/snapchat/firs/
-- stripe) are EMPTY.
--
-- SCOPE: this migration contains the ANON role only. The `authenticated` role
-- holds a co-equal cross-tenant hole ("Authenticated can view merchants"
-- USING (true) + table-wide grant + dashboard reads of nin/bvn/bank). That is
-- addressed separately in S1 and is intentionally NOT changed here.
--
-- Idempotency: REVOKE/GRANT and ALTER POLICY are naturally re-runnable; the whole
-- migration is wrapped in a single transaction so a partial apply cannot occur.
-- ============================================================================

BEGIN;

-- (a) Drop the blanket privilege. anon currently holds GRANT ALL =
--     SELECT+INSERT+UPDATE+DELETE+TRUNCATE+REFERENCES+TRIGGER (probe-confirmed).
--     REVOKE ALL (not REVOKE SELECT) is required: a table-level grant is NOT
--     overridden by a column-level REVOKE, so the column GRANT in (c) only takes
--     effect once the table-wide grant is gone. (PostgreSQL GRANT docs, Notes.)
REVOKE ALL ON TABLE public.merchants FROM anon;

-- (b) Tighten the anon row policy from USING (true) to published-only.
--     Policy name "Anon can view merchants" is verbatim from the baseline
--     migration (probe-confirmed to still exist). IS TRUE (not "= true") so a
--     NULL is_published row is EXCLUDED, never leaked.
ALTER POLICY "Anon can view merchants"
  ON public.merchants
  USING (is_published IS TRUE);

-- (c) Grant back ONLY the columns a real anon web/mobile path selects.
--     Zero SECRET columns; zero FINANCIAL columns in this permanent set.
--     Filter-oracle safe: PostgREST/Postgres require SELECT privilege on any
--     column referenced in WHERE/ORDER BY/GROUP BY, so an ungranted column
--     cannot be probed via ?col=eq.X (verified against PostgREST 13 / PG16).
GRANT SELECT (
  -- identity / presentation
  id, business_name, business_type, country, pages,
  logo_url, brand_colors, slug, payout_currency, social_media,
  -- user_id is NOT read by app code. It is required because the {public} RLS
  -- policies on public.domains (domains_select_policy) and
  -- public.merchant_feature_settings (Unified view access for feature settings)
  -- contain owner-fallback subqueries of the form
  --   merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  -- Policy expressions are evaluated with the CALLER's privileges, and anon is a
  -- member of PUBLIC, so those policies run for anon too. Without SELECT on
  -- user_id, every anon read of domains / merchant_feature_settings fails with
  -- 42501 (verified empirically). Rewriting those policies to use a SECURITY
  -- DEFINER owner check is the durable fix and is tracked with the S1 work.
  user_id,
  site_title, site_tagline, site_description,
  favicon_svg_url, favicon_png_32_url, favicon_png_192_url,
  favicon_apple_touch_url, favicon_uploaded_at,
  hero_image_ids, hero_slides, mobile_hero_slides,
  template_id,
  published_config,
  -- contact PII (already rendered on public storefronts; now published-only)
  email, phone, support_email, support_phone,
  business_address, rider_phone_number,
  -- publish + tax presentation (shown on invoices/receipts)
  is_published, published_at,
  vat_registration_status, vat_rate,
  -- non-secret plan gates
  plan_tier, premium_features, plan_expires_at,
  updated_at
) ON public.merchants TO anon;

-- ============================================================================
-- (d) OPTION-B BRIDGE — TEMPORARY, DATED, TRACKED-TO-REMOVAL.
--     These 9 FINANCIAL/BUSINESS-REG columns are granted to anon ONLY to keep two
--     existing anon paths working. Neither SHOULD be reading them as anon; both
--     must move behind service-role / SECURITY DEFINER before the grant is dropped.
--
--     Anon readers keeping this bridge alive:
--       1. Shipped mobile storefront binaries that read the raw table for receipt
--          rendering (pre-#3083). Current code uses the
--          get_storefront_receipt_merchant_info RPC and does NOT need this grant.
--       2. Guest checkout: POST /api/orders runs on the cookie-bound server client,
--          which is ANON for a signed-out shopper, and its merchant verification
--          query (apps/web/src/app/api/orders/route.ts) selects the bank_* columns
--          plus email_sender_name and registered_address for invoice/receipt data.
--
--     REMOVAL GATE — all of the following must hold before the removal migration:
--       owner:            ogabasseyy
--       deadline:         2026-08-24
--       (a) mobile:       storefront build carrying get_storefront_receipt_merchant_info
--                         (already on main) enforced as the minimum via
--                         apps/web/src/app/api/mobile/release-policy
--       (b) guest checkout: switch the POST /api/orders merchant lookup to
--                         createAdminClient() (same fix as #3063 for the Juicyway
--                         webhook) so a signed-out shopper never reads merchant bank
--                         details through the anon key
--       (c) guard:        regression test asserting anon SELECT bank_account_number
--                         FROM public.merchants FAILS after removal
--                         (supabase/migrations/tests/s0a_merchants_anon_containment.sql)
--
--     During the bridge these 9 remain anon-readable but ONLY for published stores
--     — a large reduction from today's GRANT ALL + USING (true).
-- ----------------------------------------------------------------------------
GRANT SELECT (
  bank_account_number, bank_account_name, bank_code, bank_name,
  cac_rc_number, tax_identification_number, legal_entity_name,
  email_sender_name, registered_address
) ON public.merchants TO anon;

COMMIT;
