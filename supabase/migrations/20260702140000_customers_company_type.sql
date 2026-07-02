-- disable-transaction

-- Add company/individual customer type support to the customers table.
-- Company customers store their name in company_name (first_name/last_name stay
-- null); full_name is mirrored so existing display/search paths keep working.

alter table public.customers
  add column if not exists customer_type text not null default 'individual';

alter table public.customers
  add column if not exists company_name text;

-- Guard against typo'd customer_type values from any writer path.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_customer_type_check'
  ) then
    alter table public.customers
      add constraint customers_customer_type_check
      check (customer_type in ('individual', 'company'));
  end if;
end $$;

-- Speed up per-merchant filtering by type on the customers screen segments.
create index concurrently if not exists idx_customers_merchant_type
  on public.customers (merchant_id, customer_type)
  where deleted_at is null;

-- The existing trigger recomputes full_name from first_name/last_name only, which
-- would wipe a company customer's mirrored name to '' (company customers keep
-- first/last null). Make the trigger company-aware so full_name reflects
-- company_name for companies, and also fire when company_name/customer_type
-- change so edits keep full_name in sync.
create or replace function public.update_customer_full_name()
  returns trigger
  language plpgsql
  set search_path to 'pg_catalog', 'public'
  as $$
begin
  if new.customer_type = 'company' then
    new.full_name := nullif(btrim(coalesce(new.company_name, '')), '');
  else
    new.full_name := nullif(
      btrim(concat(coalesce(new.first_name, ''), ' ', coalesce(new.last_name, ''))),
      ''
    );
  end if;
  return new;
end;
$$;

create or replace trigger trigger_update_customer_full_name
  before insert or update of first_name, last_name, company_name, customer_type
  on public.customers
  for each row
  execute function public.update_customer_full_name();
