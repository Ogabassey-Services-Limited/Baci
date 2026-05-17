-- H4: imei_lookups is a money/result table. Even with the column-scoped
-- grants + ownership RLS, an authenticated customer could directly INSERT a
-- row for their own customer_id with status='completed' and UPDATE
-- cached_response/cached_status/status with a forged "clean device" report
-- under a chosen idempotency_key. The route's idempotency replay
-- (findLookupByIdempotencyKey -> mapExistingLookup) would then serve that
-- forged result -- a free, spoofed IMEI verification with no payment. RLS
-- gates ownership, not value legitimacy, so it cannot prevent this.
--
-- The route is the only legitimate writer and now performs all imei_lookups
-- INSERT/UPDATE through the service-role client. Remove authenticated
-- INSERT/UPDATE entirely (SELECT + the ownership read policy stay so a
-- customer can still read their own lookup history). Drop the now-dead
-- write policies.

REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;

DROP POLICY IF EXISTS "customer_inserts_own_imei_lookups"
  ON public.imei_lookups;
DROP POLICY IF EXISTS "customer_updates_own_imei_lookups"
  ON public.imei_lookups;
