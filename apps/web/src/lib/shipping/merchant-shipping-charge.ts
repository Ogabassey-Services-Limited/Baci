import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { shouldReleaseBookingLock } from './order-shipment-booking-lock-errors';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

export type MerchantShippingCharge = {
  chargeId: string;
  chargedAmount: number;
  balanceAfter: number;
  status: string;
};

function row<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function attemptToken(): string {
  return randomBytes(32).toString('hex');
}

export async function reserveMerchantShippingCharge(
  supabase: SupabaseClient,
  orderId: string,
  quoteId: string
): Promise<{ charge: MerchantShippingCharge; token: string }> {
  const token = attemptToken();
  const { data, error } = await supabase.rpc(
    'reserve_merchant_shipping_charge',
    {
      p_order_id: orderId,
      p_quote_id: quoteId,
      p_attempt_token: token,
    }
  );
  if (error) {
    if (error.message?.includes('MERCHANT_WALLET_INSUFFICIENT')) {
      throw new OrderShipmentBookingError(
        'Insufficient merchant wallet balance.',
        409,
        'MERCHANT_WALLET_INSUFFICIENT'
      );
    }
    throw new OrderShipmentBookingError(
      'Unable to reserve merchant wallet for shipping.',
      409,
      'MERCHANT_WALLET_RESERVATION_FAILED'
    );
  }
  const charge = row(
    data as
      | (MerchantShippingCharge & {
          charge_id?: string;
          charged_amount?: number;
          balance_after?: number;
        })
      | (MerchantShippingCharge & {
          charge_id?: string;
          charged_amount?: number;
          balance_after?: number;
        })[]
      | null
  );
  if (!charge?.chargeId && !charge?.charge_id) {
    throw new OrderShipmentBookingError(
      'Unable to reserve merchant wallet for shipping.',
      409,
      'MERCHANT_WALLET_RESERVATION_FAILED'
    );
  }
  const normalized = charge;
  return {
    charge: {
      chargeId: normalized.chargeId ?? normalized.charge_id ?? '',
      chargedAmount: Number(
        normalized.chargedAmount ?? normalized.charged_amount ?? 0
      ),
      balanceAfter: Number(
        normalized.balanceAfter ?? normalized.balance_after ?? 0
      ),
      status: normalized.status,
    },
    token,
  };
}

export async function beginMerchantShippingChargeSubmission(
  supabase: SupabaseClient,
  chargeId: string,
  token: string
) {
  const { data, error } = await supabase.rpc(
    'begin_merchant_shipping_charge_submission',
    { p_charge_id: chargeId, p_attempt_token: token }
  );
  if (error)
    throw new OrderShipmentBookingError(
      'Unable to begin shipment submission.',
      500,
      'MERCHANT_WALLET_SUBMISSION_FAILED'
    );
  return typeof data === 'string'
    ? data
    : row(data as string[] | string | null);
}

export async function completeMerchantShippingCharge(
  supabase: SupabaseClient,
  chargeId: string,
  token: string,
  shipmentId: string
) {
  const { data, error } = await supabase.rpc(
    'complete_merchant_shipping_charge',
    { p_charge_id: chargeId, p_attempt_token: token, p_shipment_id: shipmentId }
  );
  if (error)
    throw new OrderShipmentBookingError(
      'Unable to complete shipment charge.',
      500,
      'MERCHANT_WALLET_COMPLETION_FAILED'
    );
  return typeof data === 'string'
    ? data
    : row(data as string[] | string | null);
}

export async function refundMerchantShippingCharge(
  supabase: SupabaseClient,
  chargeId: string,
  token: string,
  reasonCode: string
) {
  await supabase.rpc('refund_merchant_shipping_charge', {
    p_charge_id: chargeId,
    p_attempt_token: token,
    p_reason_code: reasonCode,
  });
}

export async function markMerchantShippingChargeForReconciliation(
  supabase: SupabaseClient,
  chargeId: string,
  token: string,
  reasonCode: string,
  providerReference?: string
) {
  await supabase.rpc('mark_merchant_shipping_charge_for_reconciliation', {
    p_charge_id: chargeId,
    p_attempt_token: token,
    p_reason_code: reasonCode,
    p_provider_reference: providerReference ?? null,
  });
}

export function isAmbiguousShippingBookingError(error: unknown): boolean {
  return (
    error instanceof OrderShipmentBookingError &&
    !shouldReleaseBookingLock(error)
  );
}
