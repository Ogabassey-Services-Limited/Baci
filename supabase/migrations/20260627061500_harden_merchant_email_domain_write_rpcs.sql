-- Harden merchant email-domain writes: authenticated clients may read their
-- row, but they may not mutate provider-controlled verification columns through
-- direct table DML or direct RPC calls. Server routes use these narrowly-scoped
-- service_role-only RPCs after authenticating the merchant owner, passing CSRF,
-- enforcing the feature gate, and verifying ZeptoMail/provider state.

revoke insert, update on public.merchant_email_domains from authenticated;

drop policy if exists "merchant_email_domains_owner_insert"
  on public.merchant_email_domains;
drop policy if exists "merchant_email_domains_owner_update"
  on public.merchant_email_domains;

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

  if not exists (
    select 1
    from public.domains as d
    where d.merchant_id = p_merchant_id
      and d.status = 'active'
      and lower(d.domain) in (
        v_domain,
        case when v_domain like 'www.%' then substring(v_domain from 5) else 'www.' || v_domain end
      )
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

create or replace function public.save_merchant_email_domain_verification(
  p_actor_user_id uuid,
  p_merchant_id uuid,
  p_checked_domain text,
  p_checked_zeptomail_domain_id text,
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
  v_status text := coalesce(p_status, 'pending');
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if v_status not in ('pending', 'verified', 'failed') then
    raise exception 'Invalid verification status';
  end if;

  update public.merchant_email_domains as med
  set
    zeptomail_domain_id = p_zeptomail_domain_id,
    status = v_status,
    verified_at = case when v_status = 'verified' then coalesce(p_verified_at, now()) else null end,
    dkim_host = p_dkim_host,
    dkim_value = p_dkim_value,
    bounce_host = p_bounce_host,
    bounce_value = p_bounce_value,
    enabled = case when v_status = 'verified' then med.enabled else false end
  where med.merchant_id = p_merchant_id
    and med.domain = lower(trim(p_checked_domain))
    and (
      (p_checked_zeptomail_domain_id is null and med.zeptomail_domain_id is null)
      or med.zeptomail_domain_id = p_checked_zeptomail_domain_id
    )
    and exists (
      select 1
      from public.merchants as m
      where m.id = med.merchant_id
        and m.user_id = v_user_id
    )
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

  if not found then
    return;
  end if;

  return next;
end;
$$;

create or replace function public.set_merchant_email_domain_enabled(
  p_actor_user_id uuid,
  p_merchant_id uuid,
  p_enabled boolean
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
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.merchant_email_domains as med
  set enabled = p_enabled
  where med.merchant_id = p_merchant_id
    and (not p_enabled or med.status = 'verified')
    and exists (
      select 1
      from public.merchants as m
      where m.id = med.merchant_id
        and m.user_id = v_user_id
    )
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

  if not found then
    return;
  end if;

  return next;
end;
$$;

revoke all on function public.save_merchant_email_domain_registration(
  uuid, uuid, text, text, text, timestamptz, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.save_merchant_email_domain_verification(
  uuid, uuid, text, text, text, text, timestamptz, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.set_merchant_email_domain_enabled(uuid, uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.save_merchant_email_domain_registration(
  uuid, uuid, text, text, text, timestamptz, text, text, text, text
) to service_role;
grant execute on function public.save_merchant_email_domain_verification(
  uuid, uuid, text, text, text, text, timestamptz, text, text, text, text
) to service_role;
grant execute on function public.set_merchant_email_domain_enabled(uuid, uuid, boolean)
  to service_role;
