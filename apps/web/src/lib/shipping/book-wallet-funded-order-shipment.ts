import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookOrderShipmentResult } from './book-order-shipment';
import {
  cleanupPreSubmissionReservation,
  hasReservedMerchantShippingCharge,
} from './book-wallet-funded-reservation-cleanup';
import {
  completePendingWalletExistingShipment,
  readPendingWalletExistingShipment,
} from './finalize-wallet-funded-existing-shipment';
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
type ChargeReservation = Awaited<
  ReturnType<typeof reserveMerchantShippingCharge>
>;
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
  // Wallet RPCs enforce merchant-owner or orders.fulfill/orders.edit access.
  if (!merchantId) {
    throw new OrderShipmentBookingError(
      'Merchant context is required.',
      400,
      'MERCHANT_NOT_FOUND'
    );
  }
  let pendingExistingShipment: BookOrderShipmentResult | null = null;
  if (readExistingShipment) {
    pendingExistingShipment = await readPendingWalletExistingShipment(
      readExistingShipment,
      releaseLock
    );
  }
  let preparedQuoteId = quoteId;
  let reservation: ChargeReservation | undefined;
  const reservedChargeState = await hasReservedMerchantShippingCharge(
    supabase,
    orderId,
    quoteId
  );
  if (reservedChargeState !== false) {
    reservation = await reserveMerchantShippingCharge(
      supabase,
      orderId,
      quoteId
    );
  }
  const resumedExistingReservation = Boolean(reservation);
  if (
    prepareQuote &&
    !pendingExistingShipment &&
    (!reservation || reservedChargeState !== false)
  ) {
    try {
      preparedQuoteId = await prepareQuote();
    } catch (error) {
      if (reservation) {
        await cleanupPreSubmissionReservation(
          supabase,
          reservation,
          error instanceof OrderShipmentBookingError
            ? error.code
            : 'QUOTE_REFRESH_FAILED',
          releaseLock
        );
      } else if (releaseLock) {
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
  if (!reservation) {
    reservation = await reserveMerchantShippingCharge(
      supabase,
      orderId,
      preparedQuoteId
    );
  }
  if (
    resumedExistingReservation &&
    reservation.charge.status === 'reserved' &&
    preparedQuoteId !== quoteId
  ) {
    const quoteChangedError = new OrderShipmentBookingError(
      'The shipping quote changed or expired. Please get a new quote and confirm shipping before booking.',
      409,
      'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
    );
    await cleanupPreSubmissionReservation(
      supabase,
      reservation,
      quoteChangedError.code,
      releaseLock
    );
    throw quoteChangedError;
  }
  const { charge, token } = reservation;
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
  if (pendingExistingShipment) {
    return completePendingWalletExistingShipment(
      supabase,
      charge.chargeId,
      token,
      charge.status,
      pendingExistingShipment,
      releaseLock
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
