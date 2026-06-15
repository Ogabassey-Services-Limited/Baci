create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,
  address text,
  store_credit numeric default 0,
  total_orders integer default 0,
  total_spent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add RLS policies
alter table customers enable row level security;

create policy "Merchants can view their own customers"
  on customers for select
  using (merchant_id in (select id from merchants where user_id = auth.uid()));

create policy "Merchants can insert their own customers"
  on customers for insert
  with check (merchant_id in (select id from merchants where user_id = auth.uid()));

create policy "Merchants can update their own customers"
  on customers for update
  using (merchant_id in (select id from merchants where user_id = auth.uid()));

create policy "Merchants can delete their own customers"
  on customers for delete
  using (merchant_id in (select id from merchants where user_id = auth.uid()));
