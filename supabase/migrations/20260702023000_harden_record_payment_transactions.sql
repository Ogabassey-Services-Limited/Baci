-- Prevent forged transaction rows from poisoning record-payment guards.
--
-- Supabase exposes granted functions and table writes through the Data API, so
-- authenticated writes must enforce both merchant access and order ownership.
-- The record-payment guard RPC still reads through the verified order scope,
-- but it only returns transaction rows whose denormalized merchant_id matches
-- that verified order. Any legacy mismatch needs explicit reconciliation
-- instead of silently counting as collected money.
create or replace function public.get_record_payment_order_transactions(
  p_order_id uuid,
  p_merchant_id uuid
)
returns table (
  amount numeric,
  gateway text,
  gateway_reference text,
  status text,
  error_code text
)
language sql
security definer
set search_path = ''
as $$
  with verified_order as (
    select o.id, o.merchant_id
    from public.orders as o
    where o.id = p_order_id
      and o.merchant_id = p_merchant_id
      and public.has_merchant_access(o.merchant_id)
  ),
  drifted_transaction as (
    select exists (
      select 1
      from public.transactions as t
      join verified_order as o
        on o.id = t.order_id
      where t.merchant_id is distinct from o.merchant_id
        and t.status in ('completed', 'pending', 'processing')
    ) as has_drift
  ),
  reconciliation_required as (
    select
      null::numeric as amount,
      null::text as gateway,
      null::text as gateway_reference,
      null::text as status,
      'ORDER_PAYMENT_RECONCILIATION_REQUIRED'::text as error_code
    from drifted_transaction
    where has_drift
  )
  select
    amount,
    gateway,
    gateway_reference,
    status,
    error_code
  from reconciliation_required
  union all
  select
    t.amount,
    t.gateway,
    t.gateway_reference,
    t.status,
    null::text as error_code
  from public.transactions as t
  join verified_order as o
    on o.id = t.order_id
  cross join drifted_transaction as d
  where t.merchant_id = o.merchant_id
    and not d.has_drift
    and t.status in ('completed', 'pending', 'processing');
$$;

revoke all on function public.get_record_payment_order_transactions(uuid, uuid) from public;
grant execute on function public.get_record_payment_order_transactions(uuid, uuid) to authenticated;

comment on function public.get_record_payment_order_transactions(uuid, uuid) is
  'Returns trusted same-merchant transaction rows for a verified order, or an explicit reconciliation error when legacy/drifted order transaction rows exist.';

drop policy if exists "transactions_insert_policy" on public.transactions;

create policy "transactions_insert_policy"
  on public.transactions
  for insert
  to authenticated
  with check (
    public.has_merchant_access(merchant_id)
    and (
      order_id is null
      or exists (
        select 1
        from public.orders as o
        where o.id = transactions.order_id
          and o.merchant_id = transactions.merchant_id
      )
    )
  );
