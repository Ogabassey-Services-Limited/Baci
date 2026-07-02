-- Serialize manual payment recording per order.
--
-- The API route can perform cheap prechecks for better UX, but the balance
-- check and transaction insert must be atomic. This function locks the verified
-- merchant-owned order row, recomputes completed payments inside that lock, and
-- inserts the manual transaction only if the order still has enough balance.
create or replace function public.record_manual_order_payment(
  p_merchant_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_currency text,
  p_gateway_reference text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_current_paid numeric := 0;
  v_wallet_used numeric := 0;
  v_total_paid_before numeric := 0;
  v_order_total numeric := 0;
  v_remaining_before numeric := 0;
  v_new_paid numeric := 0;
  v_remaining_balance numeric := 0;
  v_transaction_id uuid;
  v_payment_status text;
  v_shipping_status text;
  v_cancelled_at timestamptz;
  v_gateway_reference text := nullif(trim(p_gateway_reference), '');
begin
  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    return jsonb_build_object('error_code', 'INVALID_AMOUNT');
  end if;

  if p_amount <> round(p_amount, 2) then
    return jsonb_build_object('error_code', 'INVALID_AMOUNT');
  end if;

  -- Serialize every order-scoped payment writer before either pending-processor
  -- or completed-manual rows can be inserted. Row locks alone do not protect
  -- against concurrent transaction inserts that have not yet touched orders.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('baci_order_payment:' || p_order_id::text, 0)
  );

  select
    o.id,
    o.merchant_id,
    o.currency,
    o.payment_status,
    o.shipping_status,
    o.cancelled_at,
    coalesce(o.total, 0)::numeric as total,
    coalesce(o.wallet_amount_used, 0)::numeric as wallet_amount_used
  into v_order
  from public.orders as o
  where o.id = p_order_id
    and o.merchant_id = p_merchant_id
    and public.has_merchant_access(o.merchant_id)
  for update;

  if not found then
    return jsonb_build_object('error_code', 'ORDER_NOT_FOUND');
  end if;

  if exists (
    select 1
    from public.transactions as t
    where t.order_id = p_order_id
      and t.merchant_id is distinct from p_merchant_id
      and t.status in ('completed', 'pending', 'processing')
  ) then
    return jsonb_build_object(
      'error_code', 'ORDER_PAYMENT_RECONCILIATION_REQUIRED'
    );
  end if;

  if exists (
    select 1
    from public.transactions as t
    where t.order_id = p_order_id
      and t.merchant_id = p_merchant_id
      and t.status in ('pending', 'processing')
      and lower(coalesce(t.gateway, '')) in (
        'paystack',
        'korapay',
        'kuda',
        'credit_direct',
        'credpal',
        'klump',
        'juicyway'
      )
  ) then
    return jsonb_build_object('error_code', 'PENDING_GATEWAY_PAYMENT');
  end if;

  select coalesce(sum(coalesce(t.amount, 0)), 0)::numeric
  into v_current_paid
  from public.transactions as t
  where t.order_id = p_order_id
    and t.merchant_id = p_merchant_id
    and t.status = 'completed';

  v_wallet_used := coalesce(v_order.wallet_amount_used, 0);
  v_order_total := coalesce(v_order.total, 0);
  v_total_paid_before := v_current_paid + v_wallet_used;
  v_remaining_before := v_order_total - v_total_paid_before;

  if v_remaining_before <= 0 then
    return jsonb_build_object(
      'error_code', 'ORDER_ALREADY_PAID',
      'current_paid', v_current_paid,
      'total_paid_before', v_total_paid_before,
      'remaining_balance', greatest(0, v_remaining_before)
    );
  end if;

  if p_amount > v_remaining_before then
    return jsonb_build_object(
      'error_code', 'AMOUNT_EXCEEDS_REMAINING_BALANCE',
      'current_paid', v_current_paid,
      'total_paid_before', v_total_paid_before,
      'remaining_balance', greatest(0, v_remaining_before)
    );
  end if;

  if v_gateway_reference is not null and exists (
    select 1
    from public.transactions as t
    where t.order_id = p_order_id
      and t.merchant_id = p_merchant_id
      and t.gateway_reference = v_gateway_reference
      and t.status = 'completed'
  ) then
    return jsonb_build_object('error_code', 'DUPLICATE_REFERENCE');
  end if;

  insert into public.transactions (
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    description,
    metadata
  )
  values (
    p_merchant_id,
    p_order_id,
    'payment',
    p_amount,
    -- Keep p_currency in the signature for route compatibility, but never
    -- trust direct RPC callers to choose a currency different from the order.
    coalesce(nullif(trim(v_order.currency), ''), 'NGN'),
    'completed',
    'manual',
    v_gateway_reference,
    p_description,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_transaction_id;

  v_new_paid := v_total_paid_before + p_amount;
  v_remaining_balance := greatest(0, v_order_total - v_new_paid);

  update public.orders as o
  set
    payment_status = case
      when v_new_paid >= v_order_total then 'paid'
      else 'partially_paid'
    end,
    shipping_status = case
      when o.shipping_status = 'pending' then 'processing'
      else o.shipping_status
    end,
    updated_at = now()
  where o.id = p_order_id
    and o.merchant_id = p_merchant_id
  returning
    o.payment_status::text,
    o.shipping_status::text,
    o.cancelled_at
  into v_payment_status, v_shipping_status, v_cancelled_at;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'current_paid', v_current_paid,
    'total_paid_before', v_total_paid_before,
    'new_paid', v_new_paid,
    'remaining_balance', v_remaining_balance,
    'order_total', v_order_total,
    'previous_payment_status', v_order.payment_status,
    'previous_shipping_status', v_order.shipping_status,
    'payment_status', v_payment_status,
    'shipping_status', v_shipping_status,
    'cancelled_at', v_cancelled_at,
    'error_code', null
  );
exception
  when unique_violation then
    return jsonb_build_object('error_code', 'DUPLICATE_REFERENCE');
end;
$$;

revoke all on function public.record_manual_order_payment(uuid, uuid, numeric, text, text, text, jsonb) from public;
grant execute on function public.record_manual_order_payment(uuid, uuid, numeric, text, text, text, jsonb) to authenticated;

comment on function public.record_manual_order_payment(uuid, uuid, numeric, text, text, text, jsonb) is
  'Atomically records a manual order payment by taking a transaction-level per-order advisory lock, locking the merchant-owned order row, rejecting invalid amounts, pending processor payments, drifted order transactions, stale overpayments, and duplicate references, then inserting the transaction and updating order status in one database transaction.';
