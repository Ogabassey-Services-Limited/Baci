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
-- (d) OPTION-B BANK BRIDGE — TEMPORARY, DATED, TRACKED-TO-REMOVAL.
--     These 7 FINANCIAL/BUSINESS-REG columns are granted to anon ONLY so that
--     already-installed mobile storefront binaries (which read the raw table for
--     receipt rendering, pre-#3083) do not throw. Current code reads them via the
--     get_storefront_receipt_merchant_info SECURITY DEFINER RPC and does NOT
--     need this grant.
--
--     REMOVAL GATE — all four must hold before the removal migration ships:
--       owner:            ogabasseyy
--       removal version:  storefront build carrying get_storefront_receipt_merchant_info
--                         (already on main) enforced as the minimum via
--                         apps/web/src/app/api/mobile/release-policy
--       deadline:         2026-08-24
--       guard:            regression test asserting anon SELECT bank_account_number
--                         FROM public.merchants FAILS after removal
--                         (see supabase/migrations/tests/s0a_merchants_anon_containment.sql)
--
--     Removal = a follow-up migration dropping exactly these 7 columns from the
--     anon grant once the min-version gate enforces the fixed client. During the
--     bridge these 7 remain anon-readable but ONLY for published stores — a large
--     reduction from today's GRANT ALL + USING(true).
-- ----------------------------------------------------------------------------
GRANT SELECT (
  bank_account_number, bank_account_name, bank_code, bank_name,
  cac_rc_number, tax_identification_number, legal_entity_name
) ON public.merchants TO anon;

COMMIT;
