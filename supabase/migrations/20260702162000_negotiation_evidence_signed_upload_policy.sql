-- Allow the storefront evidence API to initialize signed uploads without using
-- the service-role client and without opening general anonymous Storage writes.
-- The API signs a short-lived JWT containing negotiation_evidence_upload=true
-- and merchant_id=<folder>. Public anon clients do not have this claim, so they
-- cannot create signed upload URLs or upload directly with the anon key.

drop policy if exists "negotiation_evidence_signed_upload_init" on storage.objects;
create policy "negotiation_evidence_signed_upload_init"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'negotiation-evidence'
    and coalesce((auth.jwt() ->> 'negotiation_evidence_upload')::boolean, false)
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'merchant_id')
  );
