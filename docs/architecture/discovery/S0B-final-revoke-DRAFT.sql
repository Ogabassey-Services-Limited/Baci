-- ============================================================================
-- ⚠️⚠️⚠️  DO NOT MERGE. DO NOT PLACE IN supabase/migrations/.  ⚠️⚠️⚠️
-- ============================================================================
-- This is the FINAL S0-B revoke migration in DRAFT form. It is intentionally
-- kept out of supabase/migrations/ so it CANNOT ship until the whole S0-B
-- sequence is proven in production. Shipping it early hard-breaks receipt/
-- invoice rendering for every mobile-storefront binary still reading the raw
-- merchants bank columns as anon (PostgREST fails the whole SELECT when ANY
-- requested column is denied).
--
-- WHEN THIS MAY BECOME A REAL MIGRATION (all must hold — see S0B-runbook.md):
--   owner:    ogabasseyy
--   deadline: 2026-08-24 (S0-A Option-B bridge removal deadline)
--   (1) mobile-storefront + mobile-admin releases that read receipt/bank data
--       ONLY via the order-scoped boundary
--       (get_order_receipt_bank_details / the receipt-bank-details Route
--       Handler) are LIVE on the stores.
--   (2) /api/mobile/release-policy has MOBILE_STOREFRONT_<platform>_MIN_BUILD
--       set to the first build carrying that boundary, and MobileUpdateController
--       is proven to hard-gate (nativeUpdateRequired) BEFORE any guest or
--       authenticated affected Supabase query runs on older builds.
--   (3) Guest checkout no longer reads merchant bank/contact columns through the
--       anon cookie client (POST /api/orders merchant lookup moved to the
--       service-role admin client — see S0-A section (d) note).
--   (4) The regression guard below is committed and green.
--
-- To promote: copy this body into
--   supabase/migrations/<YYYYMMDDHHMMSS>_s0b_revoke_anon_merchants_bridge.sql
-- re-run shasum -a 256, and register it in the history-replay manifest
-- (PENDING_SOURCES + expected-pending-sources.test-support.ts + the count bump).
-- ============================================================================

BEGIN;

-- Revoke the 9 TEMPORARY Option-B bridge column grants added by
-- 20260713150000_s0a_merchants_anon_containment.sql section (d). After this,
-- NO bank/business-registration/contact-sender column is selectable by anon;
-- receipts read their bank/tax identity only through the order-scoped
-- SECURITY DEFINER RPC get_order_receipt_bank_details (capability/ownership
-- scoped), never a merchant-id-wide public table read.
--
-- A column-level REVOKE is the correct primitive here: S0-A left NO table-level
-- SELECT for anon (it did REVOKE ALL then a minimal column GRANT), so removing
-- these specific column privileges fully closes the surface.
REVOKE SELECT (
  -- financial
  bank_account_number, bank_account_name, bank_code, bank_name,
  -- business registration / legal identity
  cac_rc_number, tax_identification_number, legal_entity_name,
  -- contact-sender fields the bridge retained for legacy receipt rendering
  email_sender_name, registered_address
) ON public.merchants FROM anon;

COMMIT;

-- ----------------------------------------------------------------------------
-- REGRESSION GUARD (run as anon after applying — must ALL fail with 42501):
-- ----------------------------------------------------------------------------
--   SET ROLE anon;
--   -- each of these must raise "permission denied for ... merchants":
--   SELECT bank_account_number       FROM public.merchants LIMIT 1;
--   SELECT cac_rc_number             FROM public.merchants LIMIT 1;
--   SELECT registered_address        FROM public.merchants LIMIT 1;
--   -- filter-oracle probe must ALSO fail (SELECT priv is required on any column
--   -- referenced in WHERE), so anon cannot enumerate values indirectly:
--   SELECT id FROM public.merchants WHERE bank_account_number = '0' LIMIT 1;
--   RESET ROLE;
--
-- POSITIVE CHECKS (must still succeed):
--   -- published presentation columns remain anon-readable:
--   SET ROLE anon; SELECT business_name, logo_url FROM public.merchants
--     WHERE is_published IS TRUE LIMIT 1; RESET ROLE;
--   -- guest capability still returns the order's bank details:
--   SELECT * FROM public.get_order_receipt_bank_details(
--     '<order-uuid>'::uuid, '<order-tracking-token>');
--   -- wrong token / non-owner returns ZERO rows (fail-closed):
--   SELECT * FROM public.get_order_receipt_bank_details(
--     '<order-uuid>'::uuid, 'wrong-token');   -- 0 rows
-- ----------------------------------------------------------------------------
