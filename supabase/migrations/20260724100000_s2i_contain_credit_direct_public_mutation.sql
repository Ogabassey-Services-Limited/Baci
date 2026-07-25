-- S2-I (workaround-retirement plan): contain the Credit-Direct BNPL public
-- mutation surface. Folded from the owner-reviewed draft branch
-- security/s2i-disable-credit-direct (originally drafted as
-- 20260711174128_s2i_contain_credit_direct_public_mutation.sql) and shipped
-- bundled with the S2-P permanent capability boundary per the 2026-07-11 owner
-- decision (S2-I never ships alone).
--
-- WHY: public.set_credit_direct_session is SECURITY DEFINER and is currently
-- EXECUTE-able by anon + authenticated. The guest sign route
-- (apps/web/src/app/api/payments/credit-direct/sign/route.ts) calls it via the
-- anon (cookie) client, and the function lets the CALLER supply p_session_id
-- and p_signed_amount while it writes payment_method / payment_status =
-- 'bnpl_pending' / notes. It never checks credit_direct_enabled, so turning off
-- the checkout UI alone does NOT stop direct PostgREST abuse: an attacker can
-- overwrite the active session or force bnpl_pending. This migration removes
-- the public mutation surface until the permanent guest-safe capability (S2-P)
-- ships in the same bundle.
--
-- SCOPE / BLAST RADIUS: NO provider outage. An earlier draft of this migration
-- also flipped credit_direct_enabled = false for every enabled merchant
-- (exactly one: ogabassey), taking Credit-Direct checkout offline. That flag
-- flip is deliberately NOT part of this migration: it dated from before the
-- S2-P permanent capability existed, when revoking the vulnerable surface left
-- no working checkout path. It now would be pure downtime for no security gain,
-- because the vulnerability is closed by the REPLACEMENT below, not by the flag:
--   * this migration revokes the caller-controlled 5-arg identity, and
--   * the sibling S2-P migrations (20260724100100 + 20260724100200) install the
--     single-use capability token + the hardened token-gated function, which
--     derives the amount from the locked order, requires credit_direct_enabled,
--     and rejects non-payable orders.
-- The guest sign route is migrated to that path in the same bundle, so checkout
-- keeps working across the deploy and the attack surface is still removed.
--
-- DEPLOY NOTE: db-migrations run BEFORE the app deploy, so between the revoke
-- and the new bundle going live, in-flight BNPL sign attempts on the OLD bundle
-- fail closed (42501) for a few minutes. That is a fail-closed blip, not a
-- money-path risk; deploy off-peak. If payment/ops would rather not expose the
-- single merchant to brand-new checkout code immediately, disable the flag
-- OPERATIONALLY (dashboard/feature setting), verify the token flow in prod, and
-- re-enable — do not re-add a flag flip to this migration.
--
-- SAFETY: service_role retains EXECUTE, so any webhook / reconciliation path
-- that runs as the trusted backend continues to work.
--
-- RE-ENABLE: do NOT restore these grants except through S2-P (the guest-safe
-- single-use checkout capability installed in the sibling migrations
-- 20260724100100 + 20260724100200).

-- Remove the public/anon/authenticated EXECUTE surface on the exact function
-- identity. Keep service_role (trusted backend) and the postgres owner.
REVOKE EXECUTE ON FUNCTION
  public.set_credit_direct_session(uuid, text, uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION
  public.set_credit_direct_session(uuid, text, uuid, text, numeric) IS
  'CONTAINED (S2-I): public execute revoked. Retired by S2-P in favour of the '
  'capability-token boundary in 20260724100200. Do not re-grant.';
