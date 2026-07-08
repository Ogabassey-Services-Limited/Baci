-- Drop the 11-arg authenticated variant of create_domain_purchase_transaction.
-- The route now calls the 12-arg service-role-only variant via the admin
-- client, so the direct authenticated-call surface (caller-supplied pricing,
-- plan-gate bypass) is removed entirely.
--
-- Apply AFTER the route change from this branch is deployed; the deployed
-- route stops sending the 11-arg shape at that point.

DROP FUNCTION IF EXISTS public.create_domain_purchase_transaction(
  text, text, integer, numeric, numeric, numeric, text, text, text, text, uuid
);
