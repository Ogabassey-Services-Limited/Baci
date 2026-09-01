import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookOrderShipmentResult } from './book-order-shipment';
import {
  beginMerchantShippingChargeSubmission,
  completeMerchantShippingCharge,
  markMerchantShippingChargeForReconciliation,
  refundMerchantShippingCharge,
  reserveMerchantShippingCharge,
} from './merchant-shipping-charge';
import { shouldReleaseBookingLock } from './order-shipment-booking-lock-errors';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

type ReleaseLock = () => Promise<void>;

export async function bookWalletFundedOrderShipment(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  quoteId: string,
  book: () => Promise<BookOrderShipmentResult>,
  releaseLock?: ReleaseLock
): Promise<BookOrderShipmentResult> {
  // Retain the merchant context in this route-level contract; owner checks are
  // enforced by every wallet RPC before it can mutate state.
  if (!merchantId) {
    throw new OrderShipmentBookingError(
      'Merchant context is required.',
      400,
      'MERCHANT_NOT_FOUND'
    );
  }
  const { charge, token } = await reserveMerchantShippingCharge(
    supabase,
    orderId,
    quoteId
  );
  // A prior confirmation may have completed successfully. Re-enter the normal
  // booking reader so the existing persisted shipment is returned without a
  // second provider submission or wallet transition.
  if (charge.status === 'booked') return book();
  if (
    charge.status === 'refunded' ||
    charge.status === 'needs_reconciliation'
  ) {
    throw new OrderShipmentBookingError(
      'This shipment booking already requires reconciliation.',
      409,
      'MERCHANT_WALLET_BOOKING_NOT_RETRYABLE'
    );
  }
  if (charge.status === 'provider_submitting') {
    throw new OrderShipmentBookingError(
      'Shipment booking is already in progress.',
      409,
      'SHIPMENT_BOOKING_IN_PROGRESS'
    );
  }
  try {
    await beginMerchantShippingChargeSubmission(
      supabase,
      charge.chargeId,
      token
    );
    const shipment = await book();
    await completeMerchantShippingCharge(
      supabase,
      charge.chargeId,
      token,
      shipment.shipmentId
    );
    return shipment;
  } catch (error) {
    const definitive = shouldReleaseBookingLock(error);
    if (definitive) {
      await refundMerchantShippingCharge(
        supabase,
        charge.chargeId,
        token,
        error instanceof OrderShipmentBookingError
          ? error.code
          : 'BOOKING_REJECTED'
      );
      if (releaseLock) await releaseLock();
    } else {
      await markMerchantShippingChargeForReconciliation(
        supabase,
        charge.chargeId,
        token,
        error instanceof OrderShipmentBookingError
          ? error.code
          : 'UNKNOWN_PROVIDER_FAILURE'
      );
    }
    throw error;
  }
}

export function bookWalletOrCustomerCheckout(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  quoteId: string,
  fundingSource: 'customer_checkout' | 'merchant_wallet' | null | undefined,
  book: () => Promise<BookOrderShipmentResult>,
  releaseLock?: ReleaseLock
) {
  if (fundingSource !== 'merchant_wallet') return book();
  if (!merchantId || !orderId || !quoteId) {
    throw new OrderShipmentBookingError(
      'Wallet-funded booking requires the order booking path.',
      409,
      'USE_ORDER_SHIPMENT_BOOKING'
    );
  }
  return bookWalletFundedOrderShipment(
    supabase,
    merchantId,
    orderId,
    quoteId,
    book,
    releaseLock
  );
}
