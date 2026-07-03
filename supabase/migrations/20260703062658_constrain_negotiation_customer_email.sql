create table if not exists public.negotiation_request_customer_email_audit (
  negotiation_request_id uuid primary key,
  merchant_id uuid,
  customer_email text not null,
  reason text not null default 'invalid_customer_email',
  captured_at timestamp with time zone not null default now()
);

comment on table public.negotiation_request_customer_email_audit is
  'Stores invalid negotiation customer_email values cleared by the 20260703062658 migration for operational recovery.';

alter table public.negotiation_request_customer_email_audit
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'negotiation_requests_customer_email_format_check'
      and conrelid = 'public.negotiation_requests'::regclass
  ) then
    alter table public.negotiation_requests
      add constraint negotiation_requests_customer_email_format_check
      check (
        customer_email is null
        or (
          customer_email = btrim(customer_email)
          and length(customer_email) between 3 and 254
          and customer_email !~ '[[:space:]]'
          and customer_email ~* '^[^@]+@[^@]+\.[^@]+$'
        )
      ) not valid;
  end if;
end
$$;

do $$
declare
  affected_count integer;
begin
  select count(*) into affected_count
  from public.negotiation_requests
  where customer_email is not null
    and not (
      customer_email = btrim(customer_email)
      and length(customer_email) between 3 and 254
      and customer_email !~ '[[:space:]]'
      and customer_email ~* '^[^@]+@[^@]+\.[^@]+$'
    );

  raise notice 'Nulling % invalid negotiation customer_email value(s)',
    affected_count;
end
$$;

insert into public.negotiation_request_customer_email_audit (
  negotiation_request_id,
  merchant_id,
  customer_email
)
select id, merchant_id, customer_email
from public.negotiation_requests
where customer_email is not null
  and not (
    customer_email = btrim(customer_email)
    and length(customer_email) between 3 and 254
    and customer_email !~ '[[:space:]]'
    and customer_email ~* '^[^@]+@[^@]+\.[^@]+$'
  )
on conflict (negotiation_request_id) do nothing;

update public.negotiation_requests
set customer_email = null
where customer_email is not null
  and not (
    customer_email = btrim(customer_email)
    and length(customer_email) between 3 and 254
    and customer_email !~ '[[:space:]]'
    and customer_email ~* '^[^@]+@[^@]+\.[^@]+$'
  );

alter table public.negotiation_requests
  validate constraint negotiation_requests_customer_email_format_check;
