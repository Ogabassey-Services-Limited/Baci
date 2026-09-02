import type { SupabaseClient } from '@supabase/supabase-js';
import { bookRepairPickup } from '@/lib/repairs/book-repair-pickup';
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
    .eq('pickup_payment_reference', claim.reference);

  if (error) {
    console.error('Repair pickup payment status update failed:', error);
    return false;
  }
  return true;
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
    if (claim) {
      await setPickupPaymentStatus(supabase, claim, 'review');
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
  ].includes(booking.reason);
  const statusUpdated = await setPickupPaymentStatus(
    supabase,
    claim,
    shouldRetry ? 'retrying' : 'review'
  );
  if (!(statusUpdated || shouldRetry)) {
    console.error('Repair pickup review state could not be persisted:', {
      reference,
      repairId: claim.repairId,
    });
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
