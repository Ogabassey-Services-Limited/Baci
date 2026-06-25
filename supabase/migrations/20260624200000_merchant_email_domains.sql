-- Per-merchant custom sending domains for transactional email.
--
-- Lets a merchant send auth/transactional email from their own domain
-- (e.g. noreply@ogabassey.com) instead of the platform domain (usebaci.com),
-- which aligns the From-domain with the brand/links and improves inbox
-- placement. The send-auth-email edge function reads `enabled = true AND
-- status = 'verified'` rows to pick the From address; everything else keeps
-- falling back to usebaci.com.
--
-- Verification + DNS records are driven server-side via the ZeptoMail Domains
-- API (Phase 2). Merchants may READ their row (to see status); all writes go
-- through service-role API routes that enforce ownership + premium gating.

create table if not exists public.merchant_email_domains (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  -- The sending domain, e.g. 'ogabassey.com'. Mail goes from
  -- '<sender_local_part>@<domain>'.
  domain text not null
    check (
      domain ~* '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
  sender_local_part text not null default 'noreply'
    check (sender_local_part ~* '^[a-z0-9][a-z0-9.+_-]{0,63}$'),
  -- ZeptoMail Domains API bookkeeping + the DNS records the merchant must add.
  zeptomail_domain_id text,
  dkim_host text,
  dkim_value text,
  bounce_host text,
  bounce_value text,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  -- Premium toggle: only honoured by the sender when status = 'verified'.
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  -- One active sending domain per merchant (MVP).
  constraint merchant_email_domains_merchant_key unique (merchant_id)
);

-- Do not globally reserve unverified domains: only a verified domain is unique.
create unique index if not exists merchant_email_domains_verified_domain_idx
  on public.merchant_email_domains (domain)
  where status = 'verified';

-- Only the verified+enabled row matters to the sender; index it for the hook.
create index if not exists merchant_email_domains_active_idx
  on public.merchant_email_domains (merchant_id)
  where enabled and status = 'verified';

alter table public.merchant_email_domains enable row level security;

-- Merchant owners may read their own sending-domain config (status, records).
-- Writes are performed by service-role API routes only.
drop policy if exists "merchant_email_domains_owner_select"
  on public.merchant_email_domains;
create policy "merchant_email_domains_owner_select"
  on public.merchant_email_domains
  for select
  using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_email_domains.merchant_id
        and m.user_id = (select auth.uid())
    )
  );

revoke all on public.merchant_email_domains from anon, authenticated;
grant select on public.merchant_email_domains to authenticated;

-- Keep updated_at fresh.
create or replace function public.touch_merchant_email_domains_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists merchant_email_domains_touch_updated_at
  on public.merchant_email_domains;
create trigger merchant_email_domains_touch_updated_at
  before update on public.merchant_email_domains
  for each row
  execute function public.touch_merchant_email_domains_updated_at();

-- Seed Ogabassey, whose domain (ogabassey.com) is already verified in ZeptoMail
-- + DNS. Guarded + idempotent: a no-op on any environment without that slug.
insert into public.merchant_email_domains
  (merchant_id, domain, sender_local_part, status, enabled, verified_at)
select id, 'ogabassey.com', 'noreply', 'verified', true, now()
from public.merchants
where slug = 'ogabassey'
on conflict (merchant_id) do nothing;
