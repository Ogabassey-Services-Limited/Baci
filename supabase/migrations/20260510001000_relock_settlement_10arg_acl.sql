-- Phase A — A0 follow-up #2 (Δ-76)
--
-- Δ-76 (chatgpt-codex bot, P1, post-PR1562 fb9e843075 review):
-- The previous follow-up `20260510000100_finalize_settlement_signature_and_review_policy.sql`
-- did `DROP FUNCTION ... record_merchant_settlement(... 10-arg ...)` then
-- `CREATE OR REPLACE FUNCTION ...` to remove the trailing DEFAULTs (Δ-74).
-- DROP'ing a function in PostgreSQL discards its ACL; the recreated
-- function inherits the catalog's default — `GRANT EXECUTE TO PUBLIC`.
-- The migration never re-applied the REVOKE/GRANT that the original
-- `20260509110200_settlement_idempotency.sql` had set, so the 10-arg
-- signature on prod is currently callable by `anon` and `authenticated`.
-- The runtime `auth.role() = 'service_role'` guard inside the function
-- still catches them (RAISE EXCEPTION 'forbidden:...'), but defense-in-
-- depth lives at the privilege boundary — untrusted roles should not
-- even be able to invoke this SECURITY DEFINER RPC.
--
-- Verified on prod immediately before this migration:
--   9-arg wrapper:  postgres=X/postgres, service_role=X/postgres   (locked)
--   10-arg form:    =X/postgres, postgres=X/postgres,
--                   anon=X/postgres, authenticated=X/postgres,
--                   service_role=X/postgres                        (LEAKING)
--
-- This migration re-applies the lockdown that should have shipped with
-- 20260510000100. The 9-arg wrapper is untouched (its ACL is correct).

REVOKE EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT  EXECUTE ON FUNCTION public.record_merchant_settlement(
  uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
) TO service_role;
