-- Create repair status enum
create type public.repair_status as enum (
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rejected'
);

-- Create repairs table
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,

  -- Customer Details
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,

  -- Device Details
  device_type text not null, -- e.g. "Smartphone", "Laptop"
  device_model text not null, -- e.g. "iPhone 13", "MacBook Pro M1"
  issue_description text not null,
  preferred_date timestamptz,

  -- Tracking
  status public.repair_status not null default 'pending',
  ticket_number serial, -- Auto-incrementing human readable ID (scoped to table, but useful)
  admin_notes text,
  estimated_cost numeric(10, 2),

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes
create index repairs_merchant_id_idx on public.repairs(merchant_id);
create index repairs_status_idx on public.repairs(status);
create index repairs_customer_email_idx on public.repairs(customer_email);

-- Enable RLS
alter table public.repairs enable row level security;

-- Policies

-- 1. Public can create repair requests (Booking flow)
create policy "Public can create repair requests"
  on public.repairs
  for insert
  to public
  with check (true);

-- 2. Merchants can view repairs for their store
create policy "Merchants can view store repairs"
  on public.repairs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.merchants
      where merchants.id = repairs.merchant_id
      and merchants.user_id = auth.uid()
    )
  );

-- 3. Merchants can update repairs for their store
create policy "Merchants can update store repairs"
  on public.repairs
  for update
  to authenticated
  using (
    exists (
      select 1 from public.merchants
      where merchants.id = repairs.merchant_id
      and merchants.user_id = auth.uid()
    )
  );

-- 4. Merchants can delete repairs (optional, might prefer soft delete/archive)
create policy "Merchants can delete store repairs"
  on public.repairs
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.merchants
      where merchants.id = repairs.merchant_id
      and merchants.user_id = auth.uid()
    )
  );

-- Trigger Function for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Add updated_at trigger
create trigger handle_updated_at before update on public.repairs
  for each row execute procedure public.update_updated_at_column();
