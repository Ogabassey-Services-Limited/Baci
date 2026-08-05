import type { SupabaseClient } from '@supabase/supabase-js';

const NINETY_MINUTES_MS = 90 * 60 * 1000;

function getOrderRecord(row: Record<string, unknown>) {
  const orderValue = row.orders;
  const order = Array.isArray(orderValue) ? orderValue[0] : orderValue;
  if (!order || typeof order !== 'object') {
    return null;
  }
  return order as { payment_status?: unknown; shipping_status?: unknown };
}

export function getOrderStatus(row: Record<string, unknown>) {
  const order = getOrderRecord(row);
  const status = order?.payment_status;
  return typeof status === 'string' ? status : null;
}

export function getOrderShippingStatus(row: Record<string, unknown>) {
  const order = getOrderRecord(row);
  const status = order?.shipping_status;
  return typeof status === 'string' ? status : null;
}

export function isActiveOrderDvaAlias(
  row: Record<string, unknown>,
  asOf: Date
) {
  // A cancelled order's alias is never active, even if its payment_status is
  // still 'unpaid' and it is inside the 90-minute window. Otherwise a lingering
  // alias on a cancelled order would block wallet DVA top-up reconciliation.
  if (getOrderShippingStatus(row) === 'cancelled') {
    return false;
  }

  const status = getOrderStatus(row);
  if (
    status !== 'unpaid' &&
    status !== 'pending' &&
    status !== 'partially_paid'
  ) {
    return false;
  }

  const createdAtRaw = row.created_at;
  if (typeof createdAtRaw !== 'string') {
    return false;
  }

  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const expiresAtRaw = row.expires_at;
  const expiresAt =
    typeof expiresAtRaw === 'string' ? new Date(expiresAtRaw) : null;
  const expiresAtMs =
    expiresAt && !Number.isNaN(expiresAt.getTime())
      ? expiresAt.getTime()
      : Number.POSITIVE_INFINITY;
  const upperBound = Math.min(
    expiresAtMs,
    createdAt.getTime() + NINETY_MINUTES_MS
  );
  const asOfMs = asOf.getTime();

  return asOfMs >= createdAt.getTime() && asOfMs <= upperBound;
}

export async function hasActivePaystackOrderDvaAlias({
  accountNumber,
  asOf,
  supabase,
}: {
  accountNumber: string;
  asOf: Date;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('order_payment_accounts')
    .select(
      'order_id, created_at, expires_at, orders!inner(id, payment_status, shipping_status)'
    )
    .eq('provider', 'paystack')
    .eq('account_number', accountNumber);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.some((row) =>
    isActiveOrderDvaAlias(row as Record<string, unknown>, asOf)
  );
}
