-- Drop the 11-arg authenticated variant of create_domain_purchase_transaction.
-- The route now calls the 12-arg service-role-only variant via the admin
-- client (see 20260708090000_lock_domain_purchase_rpc_service_role.sql), so
-- the direct authenticated-call surface (caller-supplied pricing, plan-gate
-- bypass) is removed entirely.
--
-- Bookkeeping only: this migration was already applied to production
-- immediately after PR #2991's route change deployed (2026-07-08). Verified
-- on prod: only the 12-arg signature remains, executable by service_role
-- only (not authenticated/anon/public).

DROP FUNCTION IF EXISTS public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
);
