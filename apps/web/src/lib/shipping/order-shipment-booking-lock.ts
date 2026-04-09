import type { SupabaseClient } from '@supabase/supabase-js';
import { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';

const DEFAULT_LOCK_TIMEOUT_SECONDS = 15 * 60;

type ClaimOrderShipmentBookingRow = {
  claimed: boolean;
  shipment_id: string | null;
  tracking_number: string | null;
  shipping_status: string | null;
};

export type ClaimOrderShipmentBookingResult =
  | { status: 'claimed'; lockToken: string | null }
  | { status: 'already_booked' }
  | { status: 'in_progress' };

type RpcErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function isMissingBookingLockInfrastructure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const rpcError = error as RpcErrorLike;
  const haystack = [rpcError.message, rpcError.details, rpcError.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return (
    rpcError.code === '42883' ||
    rpcError.code === 'PGRST202' ||
    haystack.includes('claim_order_shipment_booking') ||
    haystack.includes('schema cache')
  );
}

function getClaimRow(
  value: ClaimOrderShipmentBookingRow[] | ClaimOrderShipmentBookingRow | null
): ClaimOrderShipmentBookingRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function claimOrderShipmentBooking(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  lockTimeoutSeconds = DEFAULT_LOCK_TIMEOUT_SECONDS
): Promise<ClaimOrderShipmentBookingResult> {
  const lockToken = crypto.randomUUID();
  const { data, error } = await supabase.rpc('claim_order_shipment_booking', {
    p_order_id: orderId,
    p_merchant_id: merchantId,
    p_lock_token: lockToken,
    p_lock_timeout_seconds: lockTimeoutSeconds,
  });
  const row = getClaimRow(
    data as ClaimOrderShipmentBookingRow[] | ClaimOrderShipmentBookingRow | null
  );

  if (error) {
    if (isMissingBookingLockInfrastructure(error)) {
      console.warn(
        '[Shipping] Shipment booking lock infrastructure unavailable; continuing without DB lock.'
      );
      return {
        status: 'claimed',
        lockToken: null,
      };
    }

    throw new OrderShipmentBookingError(
      'Failed to reserve this order for shipment booking.',
      500,
      'SHIPMENT_BOOKING_LOCK_FAILED'
    );
  }

  if (!row) {
    throw new OrderShipmentBookingError(
      'Order not found',
      404,
      'ORDER_NOT_FOUND'
    );
  }

  if (row.claimed) {
    return {
      status: 'claimed',
      lockToken,
    };
  }

  if (row.shipment_id || row.tracking_number) {
    return { status: 'already_booked' };
  }

  return { status: 'in_progress' };
}

export async function clearOrderShipmentBookingLock(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  lockToken: string
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      shipment_booking_lock_token: null,
      shipment_booking_started_at: null,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .eq('shipment_booking_lock_token', lockToken);

  if (error) {
    throw new OrderShipmentBookingError(
      'Failed to release the shipment booking lock.',
      500,
      'SHIPMENT_BOOKING_LOCK_RELEASE_FAILED'
    );
  }
}
