import type { SupabaseClient } from '@supabase/supabase-js';

export class SerializedInventoryUnavailableError extends Error {
  constructor() {
    super('serialized_inventory_unavailable');
    this.name = 'SerializedInventoryUnavailableError';
  }
}

export function isSerializedInventoryUnavailableError(
  error: unknown
): error is SerializedInventoryUnavailableError {
  return error instanceof SerializedInventoryUnavailableError;
}

function withCause(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

/**
 * Ensures that inventory reservations for a paid or BNPL-approved order are confirmed.
 * Invokes the `confirm_order_inventory_reservations` database function.
 * If any strict serialized items could not be confirmed (e.g., they expired and were taken),
 * throws a retryable error so payment reconciliation can retry.
 */
export async function ensurePaidOrderInventoryConfirmed(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<void> {
  const { data, error } = await supabase.rpc(
    'confirm_order_inventory_reservations',
    {
      p_merchant_id: merchantId,
      p_order_id: orderId,
    }
  );

  if (error) {
    throw withCause('Inventory confirmation failed', error);
  }

  const result = data as {
    alreadyConfirmed?: number;
    confirmedUnitCount?: number;
    reclaimedUnitCount?: number;
    missingUnitCount?: number;
    exceptionCodes?: Array<{ itemId: string; code: string }>;
  } | null;

  if (
    result?.exceptionCodes &&
    Array.isArray(result.exceptionCodes) &&
    result.exceptionCodes.length > 0
  ) {
    throw new SerializedInventoryUnavailableError();
  }
}

export interface OrderStatusRollbackSnapshot {
  payment_status: string | null;
  shipping_status: string | null;
}

export async function rollbackOrderStatusAfterInventoryConfirmationFailure(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  previousStatus: OrderStatusRollbackSnapshot
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: previousStatus.payment_status,
      shipping_status: previousStatus.shipping_status,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `rollback_order_status_after_inventory_confirmation_failure failed: ${error.message}`
    );
  }
}
