-- Harden merchant sending-domain storage so DNS domains are unique by their
-- case-insensitive identity. The registration API already lowercases inputs;
-- this keeps the table boundary safe for service-role writes and backfills any
-- mixed-case rows before adding the constraint.

do $$
begin
  if exists (
    select 1
    from public.merchant_email_domains
    group by lower(domain)
    having count(*) > 1
  ) then
    raise exception 'merchant_email_domains contains case-insensitive duplicate domains; resolve duplicates before enforcing lowercase uniqueness';
  end if;
end;
$$;

drop index if exists public.merchant_email_domains_domain_key;

update public.merchant_email_domains
set domain = lower(domain)
where domain <> lower(domain);

alter table public.merchant_email_domains
  drop constraint if exists merchant_email_domains_domain_lowercase_chk;

alter table public.merchant_email_domains
  add constraint merchant_email_domains_domain_lowercase_chk
  check (domain = lower(domain));

create unique index if not exists merchant_email_domains_domain_key
  on public.merchant_email_domains (lower(domain));
