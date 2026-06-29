-- Tighten the storefront-ownership check inside save_merchant_email_domain_registration
-- to an EXACT domain match, matching the application-layer proof
-- (assertMerchantOwnsVerifiedStorefrontDomain, which uses .eq('domain', …)).
--
-- The previous body accepted a www<->apex counterpart
--   lower(d.domain) in (v_domain, <counterpart>)
-- which would let a merchant who only verified www.example.com reserve
-- example.com as a sender (or vice versa) — a domain they have not proven they
-- control. The API routes already run the exact-match app check before calling
-- this RPC, so the loose check was unreachable in normal operation; this brings
-- the DB layer (the last line of defense, e.g. a future or direct caller) in
-- line so the protection holds even if the app check is ever bypassed.
--
-- Only the ownership `if not exists (...)` block changes; the rest of the
-- function is reproduced verbatim. CREATE OR REPLACE preserves existing grants.
create or replace function public.save_merchant_email_domain_registration(
  p_actor_user_id uuid,
  p_merchant_id uuid,
  p_domain text,
  p_zeptomail_domain_id text,
  p_status text,
  p_verified_at timestamptz,
  p_dkim_host text,
  p_dkim_value text,
  p_bounce_host text,
  p_bounce_value text
)
returns table (
  domain text,
  sender_local_part text,
  status text,
  enabled boolean,
  dkim_host text,
  dkim_value text,
  bounce_host text,
  bounce_value text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_actor_user_id;
  v_domain text := lower(trim(p_domain));
  v_registration_status text := case
    when p_status = 'verified' then 'verified'
    when p_status = 'failed' then 'failed'
    else 'pending'
  end;
  v_registration_verified_at timestamptz := case
    when p_status = 'verified' then coalesce(p_verified_at, now())
    else null
  end;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.merchants as m
    where m.id = p_merchant_id
      and m.user_id = v_user_id
  ) then
    raise exception 'Forbidden';
  end if;

  if v_domain = '' or v_domain is null then
    raise exception 'Domain is required';
  end if;

  if p_status not in ('pending', 'verified', 'failed') then
    raise exception 'Invalid verification status';
  end if;

  -- Exact-domain ownership (no www<->apex counterpart).
  if not exists (
    select 1
    from public.domains as d
    where d.merchant_id = p_merchant_id
      and d.status = 'active'
      and lower(d.domain) = v_domain
  ) then
    raise exception 'Domain must be an active verified storefront domain before email sending can be configured';
  end if;

  insert into public.merchant_email_domains as med (
    merchant_id,
    domain,
    sender_local_part,
    zeptomail_domain_id,
    dkim_host,
    dkim_value,
    bounce_host,
    bounce_value,
    status,
    enabled,
    verified_at
  ) values (
    p_merchant_id,
    v_domain,
    'noreply',
    p_zeptomail_domain_id,
    p_dkim_host,
    p_dkim_value,
    p_bounce_host,
    p_bounce_value,
    v_registration_status,
    false,
    v_registration_verified_at
  )
  on conflict (merchant_id) do update set
    domain = excluded.domain,
    sender_local_part = excluded.sender_local_part,
    zeptomail_domain_id = excluded.zeptomail_domain_id,
    dkim_host = excluded.dkim_host,
    dkim_value = excluded.dkim_value,
    bounce_host = excluded.bounce_host,
    bounce_value = excluded.bounce_value,
    status = case
      when med.domain = excluded.domain
        and med.status = 'verified'
        and excluded.status = 'verified' then med.status
      else excluded.status
    end,
    enabled = case
      when med.domain = excluded.domain
        and med.status = 'verified'
        and excluded.status = 'verified' then med.enabled
      else false
    end,
    verified_at = case
      when med.domain = excluded.domain
        and med.status = 'verified'
        and excluded.status = 'verified' then med.verified_at
      else excluded.verified_at
    end
  returning
    med.domain,
    med.sender_local_part,
    med.status,
    med.enabled,
    med.dkim_host,
    med.dkim_value,
    med.bounce_host,
    med.bounce_value
  into
    domain,
    sender_local_part,
    status,
    enabled,
    dkim_host,
    dkim_value,
    bounce_host,
    bounce_value;

  return next;
end;
$$;
