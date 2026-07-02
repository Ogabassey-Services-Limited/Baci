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
create index if not exists idx_customers_merchant_type
  on public.customers (merchant_id, customer_type)
  where deleted_at is null;
