-- Provision the private negotiation-evidence storage bucket + merchant-scoped RLS.
--
-- Storefront customers upload proof-of-lower-price evidence through the
-- server-mediated /api/storefront/negotiation-evidence route into a
-- "<merchant_id>/..." path. The owning merchant (or its staff) later mints a
-- signed URL to review it (see negotiation-evidence-actions.ts). Without RLS
-- scoping, a merchant session could sign a URL for ANY object path (a customer
-- could point evidence_url at another merchant's folder), leaking unrelated
-- evidence cross-tenant. These policies scope reads to the caller's own
-- merchant folder(s), while uploads stay behind the server route's validation
-- and rate limits instead of exposing direct anonymous Storage writes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'negotiation-evidence',
  'negotiation-evidence',
  false,
  -- Match the client's validation (MAX_NEGOTIATION_EVIDENCE_BYTES /
  -- ALLOWED_NEGOTIATION_EVIDENCE_TYPES in mobile-storefront
  -- negotiation-evidence.ts) so client-accepted evidence never silently fails at
  -- the storage layer. image/jpg is a real content-type some Android pickers report.
  10485760, -- 10 MB
  array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
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
        and s.status = 'active'
    )
  );

-- Shoppers must not write directly to Storage. The storefront upload API uses a
-- trusted server client after validating the merchant folder and file metadata.
drop policy if exists "negotiation_evidence_customer_upload" on storage.objects;
