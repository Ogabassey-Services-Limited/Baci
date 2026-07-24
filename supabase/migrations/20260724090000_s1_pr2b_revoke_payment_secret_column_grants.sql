-- ============================================================================
-- S1 PR 2b — record the payment-secret column revoke (drift closure)
-- ============================================================================
-- Production state verified 2026-07-24 with a real `SET LOCAL ROLE
-- authenticated` query (not has_column_privilege): SELECTing
-- paystack_subaccount_code or virtual_terminal_code fails with 42501 while
-- public columns remain readable, i.e. the interim incident grants from the
-- 2026-07-23 premature-revoke stabilization were already removed out-of-band.
-- Every reader now goes through the bounded SECURITY DEFINER RPCs shipped in
-- #3162/#3173 (get_merchant_paystack_subaccount_code,
-- get_merchant_virtual_terminal_code, get_merchant_paystack_subaccount_configured,
-- set/clear_merchant_virtual_terminal_code*), live in production since the
-- 2026-07-24 00:58 deploy; the admin-client paths (payments/initialize,
-- vtu-pending-transaction, agentic merchant-context) use service_role, which
-- retains table SELECT.
--
-- This migration records that end-state so replay-built environments match
-- production. On production itself it is a no-op (revoking an absent privilege
-- succeeds silently). REVOKE from anon is restated for replay environments as
-- belt-and-braces with the S0-A anon containment.
--
-- `is_platform_admin` deliberately KEEPS its authenticated grant — it is a
-- self-scoped authorization boolean read by ~15 admin routes; containing it is
-- a separate deferred follow-up in the containment plan.
--
-- With this, every financial/PII secret on merchants is denied to the
-- authenticated role at the column-ACL layer, completing S1 PR 2.

REVOKE SELECT (paystack_subaccount_code, virtual_terminal_code)
  ON public.merchants FROM authenticated;
REVOKE SELECT (paystack_subaccount_code, virtual_terminal_code)
  ON public.merchants FROM anon;
