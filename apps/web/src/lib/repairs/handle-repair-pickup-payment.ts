import type { SupabaseClient } from '@supabase/supabase-js';
import { bookRepairPickup } from '@/lib/repairs/book-repair-pickup';
import { isRepairPickupPaymentConflictError } from '@/lib/repairs/is-repair-pickup-payment-conflict-error';
import { notifyRepairPickupBookingAfterPayment } from '@/lib/repairs/notify-repair-pickup-booking';
import {
  readRepairPickupMismatchIdentity,
  recordRepairPickupPaymentMismatch,
} from '@/lib/repairs/record-repair-pickup-payment-mismatch';
import { repairPickupPaymentClaims } from '@/lib/repairs/repair-pickup-payment-claim';

type RepairPickupPaymentHandlingResult =
  | { handled: false }
  | {
      handled: true;
      status: number;
      body: { message: string; trackingNumber?: string };
    };

interface HandleRepairPickupPaymentInput {
  gateway: 'paystack' | 'korapay';
  gatewayResponse: Record<string, unknown>;
  reference: string;
  supabase: SupabaseClient;
  verifiedAmount: number;
}

function getConfirmed(value: unknown): boolean | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const confirmed = (row as Record<string, unknown>).confirmed;
  return typeof confirmed === 'boolean' ? confirmed : null;
}

async function setPickupPaymentStatus(
  supabase: SupabaseClient,
  claim: { merchantId: string; reference: string; repairId: string },
  status: 'retrying' | 'review'
): Promise<boolean> {
  const { error } = await supabase
    .from('repairs')
    .update({ pickup_payment_status: status })
    .eq('id', claim.repairId)
    .eq('merchant_id', claim.merchantId)
    .eq('pickup_payment_reference', claim.reference)
    // Never let a slower duplicate webhook overwrite a completed booking.
    .neq('pickup_payment_status', 'booked');

  if (error) {
    console.error('Repair pickup payment status update failed:', error);
    return false;
  }
  return true;
}

function mismatchReasonFor(input: {
  claim: { amountKobo: number; currency: string; reference: string } | null;
  currency: string;
  reference: string;
  verifiedAmount: number;
}): string {
  if (!input.claim) return 'claim_missing_or_invalid';
  if (input.claim.reference !== input.reference) return 'reference_mismatch';
  if (input.claim.amountKobo !== Math.round(input.verifiedAmount * 100)) {
    return 'amount_mismatch';
  }
  if (input.claim.currency !== input.currency) return 'currency_mismatch';
  return 'claim_mismatch';
}

export async function handleRepairPickupPayment({
  gateway,
  gatewayResponse,
  reference,
  supabase,
  verifiedAmount,
}: HandleRepairPickupPaymentInput): Promise<RepairPickupPaymentHandlingResult> {
  const metadata = gatewayResponse.metadata;
  if (
    gateway !== 'paystack' ||
    !metadata ||
    typeof metadata !== 'object' ||
    (metadata as Record<string, unknown>).transaction_type !== 'repair_pickup'
  ) {
    return { handled: false };
  }

  const claim = repairPickupPaymentClaims.verify(
    metadata,
    process.env.PAYSTACK_SECRET_KEY ?? ''
  );
  const currency =
    typeof gatewayResponse.currency === 'string'
      ? gatewayResponse.currency.toUpperCase()
      : '';
  if (
    !claim ||
    claim.reference !== reference ||
    claim.amountKobo !== Math.round(verifiedAmount * 100) ||
    claim.currency !== currency
  ) {
    console.error('Repair pickup payment claim mismatch:', {
      claimVerified: Boolean(claim),
      reference,
    });
    const unsigned = readRepairPickupMismatchIdentity(metadata);
    const recorded = await recordRepairPickupPaymentMismatch({
      currency: currency || 'XXX',
      gatewayResponse,
      merchantId: claim?.merchantId ?? unsigned.merchantId,
      mismatchReason: mismatchReasonFor({
        claim,
        currency,
        reference,
        verifiedAmount,
      }),
      reference,
      repairId: claim?.repairId ?? unsigned.repairId,
      supabase,
      verifiedAmount,
    });
    if (!recorded) {
      return {
        handled: true,
        status: 503,
        body: {
          message: 'Repair pickup payment mismatch will retry until durable',
        },
      };
    }
    return {
      handled: true,
      status: 200,
      body: { message: 'Repair pickup payment requires review' },
    };
  }

  const { data, error } = await supabase.rpc('confirm_repair_pickup_payment', {
    p_amount: verifiedAmount,
    p_currency: currency,
    p_gateway_response: gatewayResponse,
    p_merchant_id: claim.merchantId,
    p_reference: reference,
    p_repair_id: claim.repairId,
  });
  if (error || getConfirmed(data) === null) {
    if (isRepairPickupPaymentConflictError(error)) {
      console.error('Repair pickup payment conflicting capture:', {
        reference,
        repairId: claim.repairId,
      });
      const recorded = await recordRepairPickupPaymentMismatch({
        currency,
        gatewayResponse,
        merchantId: claim.merchantId,
        mismatchReason: 'conflicting_capture',
        reference,
        repairId: claim.repairId,
        supabase,
        verifiedAmount,
      });
      if (!recorded) {
        return {
          handled: true,
          status: 503,
          body: {
            message: 'Repair pickup payment mismatch will retry until durable',
          },
        };
      }
      return {
        handled: true,
        status: 200,
        body: { message: 'Repair pickup payment requires review' },
      };
    }
    console.error('Repair pickup payment confirmation failed:', error);
    return {
      handled: true,
      status: 503,
      body: { message: 'Repair pickup payment confirmation will retry' },
    };
  }

  const booking = await bookRepairPickup(
    supabase,
    claim.merchantId,
    claim.repairId
  );
  if (booking.ok) {
    await notifyRepairPickupBookingAfterPayment(
      supabase,
      claim.merchantId,
      claim.repairId
    );
    return {
      handled: true,
      status: 200,
      body: {
        message: 'Repair pickup payment confirmed and shipment booked',
        trackingNumber: booking.trackingNumber,
      },
    };
  }
  if (booking.reason === 'already_booked') {
    return {
      handled: true,
      status: 200,
      body: { message: 'Repair pickup payment already processed' },
    };
  }

  const shouldRetry = [
    'booking_failed',
    'booking_in_progress',
    'gigl_unavailable',
    'lookup_failed',
  ].includes(booking.reason);
  const statusUpdated = await setPickupPaymentStatus(
    supabase,
    claim,
    shouldRetry ? 'retrying' : 'review'
  );
  if (!statusUpdated) {
    // Fail closed so Paystack keeps redelivering until review/retrying is
    // durable. Do not ACK a definitive fulfillment failure while the repair
    // is still only marked paid.
    console.error('Repair pickup review state could not be persisted:', {
      reference,
      repairId: claim.repairId,
      shouldRetry,
    });
    return {
      handled: true,
      status: 503,
      body: {
        message: shouldRetry
          ? 'Repair pickup payment confirmed; shipment booking will retry'
          : 'Repair pickup payment confirmed; review state persistence will retry',
      },
    };
  }

  if (!shouldRetry) {
    await notifyRepairPickupBookingAfterPayment(
      supabase,
      claim.merchantId,
      claim.repairId
    );
  }

  return {
    handled: true,
    status: shouldRetry ? 503 : 200,
    body: {
      message: shouldRetry
        ? 'Repair pickup payment confirmed; shipment booking will retry'
        : 'Repair pickup payment confirmed; shipment requires review',
    },
  };
}
