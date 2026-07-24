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
-- SCOPE / BLAST RADIUS: exactly one merchant currently has
-- credit_direct_enabled = true (ogabassey). This takes that merchant's
-- Credit-Direct checkout option offline. It is a deliberate provider outage
-- and MUST NOT be applied without payment/ops owner approval + a
-- merchant-communication plan.
--
-- SAFETY: service_role retains EXECUTE, so any webhook / reconciliation path
-- that runs as the trusted backend continues to work.
--
-- RE-ENABLE: do NOT restore these grants or the flag except through S2-P (the
-- guest-safe single-use checkout capability installed in the sibling
-- migrations 20260724100100 + 20260724100200). Re-enabling is a separate
-- operational flag flip once the permanent path is live.

-- 1) Disable the checkout flag for every currently-enabled merchant (idempotent).
UPDATE public.merchant_feature_settings
SET credit_direct_enabled = false,
    updated_at = now()
WHERE credit_direct_enabled = true;

-- 2) Remove the public/anon/authenticated EXECUTE surface on the exact function
--    identity. Keep service_role (trusted backend) and the postgres owner.
REVOKE EXECUTE ON FUNCTION
  public.set_credit_direct_session(uuid, text, uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION
  public.set_credit_direct_session(uuid, text, uuid, text, numeric) IS
  'CONTAINED (S2-I): public execute revoked. Retired by S2-P in favour of the '
  'capability-token boundary in 20260724100200. Do not re-grant.';
