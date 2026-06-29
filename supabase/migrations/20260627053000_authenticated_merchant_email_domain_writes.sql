-- Legacy cleanup for an earlier direct-DML approach. Authenticated merchants
-- may read their own sending-domain row, but provider-controlled state
-- (`status`, `enabled`, DNS records, ZeptoMail IDs) must not be writable
-- through PostgREST table mutations. Later migrations expose narrow
-- SECURITY DEFINER RPCs that re-check ownership and accept only server-derived
-- provider state.

revoke insert, update on public.merchant_email_domains from authenticated;

drop policy if exists "merchant_email_domains_owner_insert"
  on public.merchant_email_domains;

drop policy if exists "merchant_email_domains_owner_update"
  on public.merchant_email_domains;
