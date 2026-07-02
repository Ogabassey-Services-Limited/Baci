-- Provision the private negotiation-evidence storage bucket + merchant-scoped RLS.
--
-- Storefront customers upload proof-of-lower-price evidence into a
-- "<merchant_id>/..." path (see uploadNegotiationEvidence). The owning merchant
-- later mints a signed URL to review it (see negotiation-evidence-actions.ts).
-- Without RLS scoping, a merchant session could sign a URL for ANY object path
-- (a customer could point evidence_url at another merchant's folder), leaking
-- unrelated evidence cross-tenant. These policies scope reads to the caller's
-- own merchant folder and restrict uploads to real merchant folders.

insert into storage.buckets (id, name, public)
values ('negotiation-evidence', 'negotiation-evidence', false)
on conflict (id) do nothing;

-- Merchant owners can read/sign objects only under their own <merchant_id> folder.
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
    )
  );

-- Authenticated customers upload evidence into a real merchant's folder only.
drop policy if exists "negotiation_evidence_customer_upload" on storage.objects;
create policy "negotiation_evidence_customer_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'negotiation-evidence'
    and (storage.foldername(name))[1] in (
      select (m.id)::text
      from public.merchants m
    )
  );
