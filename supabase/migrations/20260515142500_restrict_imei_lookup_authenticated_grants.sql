-- IMEI lookup writes are service-role-only. Revoke direct authenticated
-- writes here as a belt-and-suspenders guard for databases that applied an
-- earlier draft of this migration sequence.
REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;
