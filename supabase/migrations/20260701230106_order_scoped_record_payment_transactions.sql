-- Read record-payment guard transactions through the verified order scope.
--
-- The record-payment route first proves that the authenticated user can access
-- the order's merchant. A transaction row's denormalized merchant_id can drift,
-- so reading this guard data through the table RLS policy can hide real
-- gateway/manual transactions for that order. This RPC intentionally scopes by
-- the order row and then returns only the small transaction projection needed
-- to block duplicates, overpayments, and pending processor shadowing.
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
  select
    t.amount,
    t.gateway,
    t.gateway_reference,
    t.status,
    null::text as error_code
  from public.transactions as t
  where t.order_id = p_order_id
    and t.status in ('completed', 'pending', 'processing')
    and exists (
      select 1
      from public.orders as o
      where o.id = p_order_id
        and o.merchant_id = p_merchant_id
        and public.has_merchant_access(o.merchant_id)
    );
$$;

revoke all on function public.get_record_payment_order_transactions(uuid, uuid) from public;
grant execute on function public.get_record_payment_order_transactions(uuid, uuid) to authenticated;

comment on function public.get_record_payment_order_transactions(uuid, uuid) is
  'Returns the minimal transaction rows needed by record-payment after the caller proves access to the owning order merchant.';
