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
import { recoverBookedWalletShipment } from './recover-booked-wallet-shipment';

type ReleaseLock = () => Promise<void>;
type PrepareQuote = () => Promise<string>;
type BookShipment = (quoteId?: string) => Promise<BookOrderShipmentResult>;
type ReadExistingShipment = () => Promise<BookOrderShipmentResult | null>;

async function hasReservedMerchantShippingCharge(
  supabase: SupabaseClient,
  orderId: string,
  quoteId: string
): Promise<boolean> {
  if (typeof supabase.from !== 'function') return false;
  try {
    const { data, error } = await supabase
      .from('merchant_shipping_charges')
      .select('id')
      .eq('order_id', orderId)
      .eq('shipping_quote_id', quoteId)
      .eq('status', 'reserved')
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

export async function bookWalletFundedOrderShipment(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  quoteId: string,
  book: BookShipment,
  releaseLock?: ReleaseLock,
  prepareQuote?: PrepareQuote,
  readExistingShipment?: ReadExistingShipment
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
  if (readExistingShipment) {
    try {
      const existingShipment = await readExistingShipment();
      if (existingShipment) return existingShipment;
    } catch (error) {
      if (releaseLock && shouldReleaseBookingLock(error)) {
        try {
          await releaseLock();
        } catch (releaseError) {
          console.error(
            'Failed to release shipment booking lock after existing-shipment lookup error:',
            releaseError
          );
        }
      }
      throw error;
    }
  }
  let preparedQuoteId = quoteId;
  // If a prior attempt already reserved funds for this quote, resume that
  // charge instead of refreshing (refresh would fail on active-charge replace).
  const shouldPrepareQuote =
    Boolean(prepareQuote) &&
    !(await hasReservedMerchantShippingCharge(supabase, orderId, quoteId));
  if (shouldPrepareQuote && prepareQuote) {
    try {
      preparedQuoteId = await prepareQuote();
    } catch (error) {
      // Quote preparation runs after the order booking lock is claimed but
      // before any wallet reservation. Release that lock while preserving the
      // original refresh/provider error for the caller.
      if (releaseLock) {
        try {
          await releaseLock();
        } catch (releaseError) {
          console.error(
            'Failed to release shipment booking lock after quote preparation error:',
            releaseError
          );
        }
      }
      throw error;
    }
  }
  const { charge, token } = await reserveMerchantShippingCharge(
    supabase,
    orderId,
    preparedQuoteId
  );
  // A prior confirmation may have completed successfully. Recover the
  // shipment persisted on the charge instead of re-entering provider booking.
  if (charge.status === 'booked') {
    try {
      return await recoverBookedWalletShipment(
        supabase,
        merchantId,
        orderId,
        charge
      );
    } catch (error) {
      if (releaseLock && shouldReleaseBookingLock(error)) {
        try {
          await releaseLock();
        } catch (releaseError) {
          console.error(
            'Failed to release shipment booking lock after booked-charge recovery error:',
            releaseError
          );
        }
      }
      throw error;
    }
  }
  if (charge.status === 'refunded') {
    if (releaseLock) {
      try {
        await releaseLock();
      } catch (releaseError) {
        console.error(
          'Failed to release shipment booking lock after a refunded wallet charge:',
          releaseError
        );
      }
    }
    throw new OrderShipmentBookingError(
      'This wallet shipping charge was refunded. Please get a new quote before booking.',
      409,
      'MERCHANT_WALLET_CHARGE_REFUNDED'
    );
  }
  if (charge.status === 'needs_reconciliation') {
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
  let providerSubmissionStarted = false;
  try {
    await beginMerchantShippingChargeSubmission(
      supabase,
      charge.chargeId,
      token
    );
    providerSubmissionStarted = true;
    const shipment = await book(preparedQuoteId);
    await completeMerchantShippingCharge(
      supabase,
      charge.chargeId,
      token,
      shipment.shipmentId
    );
    return shipment;
  } catch (error) {
    // A failed submission transition happens before the provider booking
    // callback runs, so the reservation is safe to refund and the lock can be
    // released even when the RPC error is otherwise ambiguous.
    const definitive =
      !providerSubmissionStarted || shouldReleaseBookingLock(error);
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
          : 'UNKNOWN_PROVIDER_FAILURE',
        error instanceof OrderShipmentBookingError
          ? error.providerReference
          : undefined
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
  book: BookShipment,
  releaseLock?: ReleaseLock,
  prepareQuote?: PrepareQuote,
  readExistingShipment?: ReadExistingShipment
) {
  if (fundingSource !== 'merchant_wallet') return book(quoteId);
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
    releaseLock,
    prepareQuote,
    readExistingShipment
  );
}
