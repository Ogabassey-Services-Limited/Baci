import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookOrderShipmentResult } from './book-order-shipment';
import {
  beginMerchantShippingChargeSubmission,
  completeMerchantShippingCharge,
} from './merchant-shipping-charge';
import { shouldReleaseBookingLock } from './order-shipment-booking-lock-errors';

type ReadExistingShipment = () => Promise<BookOrderShipmentResult | null>;
type ReleaseLock = () => Promise<void>;

export async function readPendingWalletExistingShipment(
  readExistingShipment: ReadExistingShipment,
  releaseLock?: ReleaseLock
): Promise<BookOrderShipmentResult | null> {
  try {
    return await readExistingShipment();
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

export async function finalizeWalletFundedExistingShipment(
  supabase: SupabaseClient,
  chargeId: string,
  token: string,
  chargeStatus: string,
  existingShipment: BookOrderShipmentResult
): Promise<BookOrderShipmentResult> {
  if (chargeStatus === 'reserved') {
    await beginMerchantShippingChargeSubmission(supabase, chargeId, token);
  }
  await completeMerchantShippingCharge(
    supabase,
    chargeId,
    token,
    existingShipment.shipmentId
  );
  return existingShipment;
}

export async function completePendingWalletExistingShipment(
  supabase: SupabaseClient,
  chargeId: string,
  token: string,
  chargeStatus: string,
  pendingExistingShipment: BookOrderShipmentResult,
  releaseLock?: ReleaseLock
): Promise<BookOrderShipmentResult> {
  try {
    return await finalizeWalletFundedExistingShipment(
      supabase,
      chargeId,
      token,
      chargeStatus,
      pendingExistingShipment
    );
  } catch (error) {
    if (releaseLock && shouldReleaseBookingLock(error)) {
      try {
        await releaseLock();
      } catch (releaseError) {
        console.error(
          'Failed to release shipment booking lock after existing-shipment completion error:',
          releaseError
        );
      }
    }
    throw error;
  }
}
