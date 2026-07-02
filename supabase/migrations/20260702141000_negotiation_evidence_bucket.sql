-- Provision the private negotiation-evidence storage bucket + merchant-scoped RLS.
--
-- Storefront customers upload proof-of-lower-price evidence into a
-- "<merchant_id>/..." path (see uploadNegotiationEvidence). The owning merchant
-- (or its staff) later mints a signed URL to review it (see
-- negotiation-evidence-actions.ts). Without RLS scoping, a merchant session could
-- sign a URL for ANY object path (a customer could point evidence_url at another
-- merchant's folder), leaking unrelated evidence cross-tenant. These policies
-- scope reads to the caller's own merchant folder(s) and restrict uploads to real
-- merchant folders.
--
-- Negotiations are guest-friendly: `negotiation_requests` INSERT allows
-- session-based (unauthenticated) shoppers, and uploadNegotiationEvidence uploads
-- the image *before* the row is inserted, so the upload policy must also admit
-- anon. The bucket caps size + mime types so an anon writer can only add small
-- images, not arbitrary/large payloads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'negotiation-evidence',
  'negotiation-evidence',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Owners AND staff can read/sign objects under their own merchant's <id> folder,
-- mirroring who can view the negotiation_requests rows themselves.
drop policy if exists "negotiation_evidence_owner_read" on storage.objects;
create policy "negotiation_evidence_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'negotiation-evidence'
    and (storage.foldername(name))[1] in (
      select (m.id)::text
      from public.merchants m
      where m.user_id = (select auth.uid())
      union
      select (s.merchant_id)::text
      from public.staff_members s
      where s.user_id = (select auth.uid())
    )
  );

-- Shoppers (guest session or authenticated) upload evidence into a real
-- merchant's folder only. Size/mime are constrained by the bucket config above.
drop policy if exists "negotiation_evidence_customer_upload" on storage.objects;
create policy "negotiation_evidence_customer_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'negotiation-evidence'
    and (storage.foldername(name))[1] in (
      select (m.id)::text
      from public.merchants m
    )
  );
