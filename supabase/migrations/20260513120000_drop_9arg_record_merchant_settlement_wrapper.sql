-- Phase A follow-up — drop the 9-arg `record_merchant_settlement`
-- backwards-compat wrapper that shipped in
-- `20260509110200_settlement_idempotency.sql` (Path B expand-contract).
--
-- Context: PR #1562 (A0 hotfix) introduced `p_metadata jsonb` to
-- `record_merchant_settlement`, then `20260510000100` dropped the
-- DEFAULT on `p_metadata` (Δ-74 — required all 10 args to disambiguate
-- the 9-arg-named-call overload). The 9-arg wrapper at
-- `20260509110200:181-200` was kept temporarily to bridge any in-flight
-- requests from pre-deploy Vercel revisions during the rolling deploy.
--
-- Pre-conditions verified before drop:
--   1. All 7 callers in main pass `p_metadata` explicitly (10-arg form):
--        - apps/web/src/app/api/payments/verify/route.ts:483
--        - apps/web/src/app/api/payments/webhook/route.ts:956, 1593, 1837, 1937
--        - apps/web/src/app/api/payments/juicyway/webhook/route.ts:495
--        - apps/web/src/scripts/reconcile-paystack-dva-executors.ts:262
--   2. Every settlement row created since the A0 idempotency migration
--      (2026-05-10+) has non-empty metadata, proving no caller hit the
--      9-arg wrapper in prod (verified via:
--        `SELECT count(*) FROM merchant_settlements
--           WHERE created_at >= '2026-05-10' AND (metadata IS NULL OR metadata = '{}'::jsonb);`
--      returns 0).
--   3. >36 hours have elapsed since A0 shipped, so no in-flight HTTP
--      request can still be on a pre-deploy Vercel revision.
--
-- The 10-arg `record_merchant_settlement(uuid, text, uuid, text, text,
-- numeric, numeric, numeric, text, jsonb)` remains untouched. After
-- this migration, `record_merchant_settlement` has exactly one overload
-- in `pg_proc`.

DROP FUNCTION IF EXISTS public.record_merchant_settlement(
  uuid,    -- p_merchant_id
  text,    -- p_source_type
  uuid,    -- p_source_id
  text,    -- p_gateway
  text,    -- p_gateway_reference
  numeric, -- p_gross_amount
  numeric, -- p_gateway_fee
  numeric, -- p_platform_fee
  text     -- p_description
);
