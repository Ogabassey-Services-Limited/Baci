import type { SupabaseClient } from '@supabase/supabase-js';
import { claimRepairPickupBooking } from '@/lib/repairs/claim-repair-pickup-booking';
import {
  type BookRepairPickupResult,
  buildPickupItems,
  buildPickupSender,
  pickupFailure,
} from '@/lib/repairs/pickup-shipment-utils';
import { quoteRepairPickup } from '@/lib/repairs/quote-repair-pickup';
import { releaseRejectedRepairPickupReservation } from '@/lib/repairs/release-rejected-repair-pickup-reservation';
import { getRepairCenterAddress } from '@/lib/repairs/repair-center-address';
import { REPAIR_PICKUP_PROVIDER } from '@/lib/repairs/repair-pickup-constants';
import type { RepairPickupRow } from '@/lib/repairs/repair-pickup-row';
import {
  isRepairStatus,
  isTerminalRepairStatus,
} from '@/lib/repairs/repair-status';
import { shippingService } from '@/lib/shipping';
import { shouldReleaseBookingLock } from '@/lib/shipping/order-shipment-booking-lock-errors';
import type {
  BookingRequest,
  ShipmentBookingResult,
} from '@/lib/shipping/types';

/**
 * Merchant-triggered courier pickup for a repair (reverse logistics).
 * Direction: customer pickup address = sender, private repair-center address =
 * receiver. A pending shipment is linked before GIGL is contacted so ambiguous
 * failures cannot permit a second charge.
 */
export async function bookRepairPickup(
  supabase: SupabaseClient,
  merchantId: string,
  repairId: string
): Promise<BookRepairPickupResult> {
  const { data: repairData, error: repairError } = await supabase
    .from('repairs')
    .select(
      'id, merchant_id, customer_name, customer_email, customer_phone, device_type, device_model, pickup_address, shipment_id, quoted_price, status'
    )
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  const repair = repairData as RepairPickupRow | null;
  if (repairError || !repair) {
    return pickupFailure('not_found');
  }

  // A completed/cancelled/rejected repair must not trigger a paid courier pickup.
  if (isRepairStatus(repair.status) && isTerminalRepairStatus(repair.status)) {
    return pickupFailure('terminal_status');
  }

  if (repair.shipment_id) {
    return pickupFailure('already_booked');
  }

  const sender = buildPickupSender(repair);
  if (!sender) {
    return pickupFailure('missing_pickup_address');
  }

  const receiver = await getRepairCenterAddress(merchantId);
  if (!receiver) {
    return pickupFailure('repair_center_unconfigured');
  }

  const items = buildPickupItems(repair);
  let quoteResult: Awaited<ReturnType<typeof quoteRepairPickup>>;
  try {
    quoteResult = await quoteRepairPickup({
      items,
      merchantId,
      receiver,
      sender,
    });
  } catch (error) {
    console.error('Repair pickup quote failed:', error);
    return pickupFailure('gigl_unavailable');
  }

  const { quote, request: quoteRequest } = quoteResult;
  if (!quote) {
    return pickupFailure('gigl_unavailable');
  }

  const { data: quoteRowData, error: quoteInsertError } = await supabase
    .from('repair_pickup_quotes')
    .insert({
      merchant_id: merchantId,
      repair_id: repairId,
      provider: REPAIR_PICKUP_PROVIDER,
      service_tier: quote.serviceTier,
      carrier_name: quote.carrierName,
      provider_rate_id: quote.providerRateId ?? null,
      charge: quote.price,
      currency: quote.currency,
      estimated_days: quote.estimatedDays,
      quote_request: quoteRequest,
      provider_metadata: quote.rawResponse ?? null,
      expires_at: quote.expiresAt.toISOString(),
    })
    .select('id')
    .single();

  const quoteRow = quoteRowData as { id: string } | null;
  if (quoteInsertError || !quoteRow) {
    console.error('Failed to persist repair pickup quote:', quoteInsertError);
    return pickupFailure('booking_failed');
  }

  const bookingRequest: BookingRequest = {
    orderId: repairId,
    quoteId: quoteRow.id,
    merchantId,
    providerRateId: quote.providerRateId || undefined,
    quoteMetadata: quote.rawResponse,
    sender,
    receiver: quoteRequest.receiver,
    items,
    pickupType: 'pickup',
  };

  const claim = await claimRepairPickupBooking(supabase, merchantId, repairId);
  if (claim.status === 'not_found') {
    return pickupFailure('not_found');
  }
  if (claim.status === 'terminal') {
    // Never book a paid pickup after a concurrent terminal transition.
    return pickupFailure('terminal_status');
  }
  if (claim.status === 'already_booked') {
    return pickupFailure('already_booked');
  }
  if (claim.status === 'booking_in_progress') {
    return pickupFailure('booking_in_progress');
  }
  if (claim.status === 'failed') {
    return pickupFailure('booking_failed');
  }

  // Reserve locally first so ambiguous provider failures cannot be retried.
  const { data: shipmentData, error: shipmentError } = await supabase
    .from('shipments')
    .insert({
      order_id: null,
      merchant_id: merchantId,
      provider: REPAIR_PICKUP_PROVIDER,
      provider_shipment_id: null,
      tracking_number: null,
      carrier_name: quote.carrierName,
      status: 'pending',
      sender_address: sender,
      receiver_address: quoteRequest.receiver,
      items,
      price: quote.price,
      currency: quote.currency,
      estimated_delivery_days: quote.estimatedDays,
      is_station_pickup: false,
      station_name: null,
      station_address: null,
      pickup_scheduled_at: null,
      label_url: null,
      provider_response: quote.rawResponse ?? null,
    })
    .select('id')
    .single();

  const shipment = shipmentData as { id: string } | null;
  if (shipmentError || !shipment) {
    console.error('Repair pickup shipment could not be saved:', shipmentError);
    return pickupFailure('shipment_save_failed');
  }

  const { data: linkedRepairData, error: linkError } = await supabase
    .from('repairs')
    .update({
      shipment_id: shipment.id,
    })
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .eq('pickup_booking_lock_token', claim.lockToken)
    .is('shipment_id', null)
    // Belt-and-braces: also refuse to link (and therefore refuse the paid
    // bookShipment below) if the repair reached a terminal status in the tiny
    // window after the claim. The claim guard fails closed too; this covers the
    // claim -> link -> bookShipment gap.
    .not('status', 'in', '(completed,cancelled,rejected)')
    .select('id');

  if (linkError) {
    console.error('Repair pickup booked but link failed:', linkError);
    return pickupFailure('shipment_save_failed');
  }

  const linkedRepair = Array.isArray(linkedRepairData)
    ? linkedRepairData[0]
    : null;
  if (!linkedRepair) {
    console.error(
      'Repair pickup reservation could not be linked to the claimed repair'
    );
    return pickupFailure('shipment_save_failed');
  }

  let booking: ShipmentBookingResult;
  try {
    booking = await shippingService.bookShipment(
      REPAIR_PICKUP_PROVIDER,
      bookingRequest
    );
  } catch (error) {
    if (shouldReleaseBookingLock(error)) {
      const released = await releaseRejectedRepairPickupReservation(
        supabase,
        merchantId,
        repairId,
        shipment.id,
        claim.lockToken
      );
      if (released) {
        return pickupFailure('booking_failed');
      }
    }

    // The linked pending shipment prevents an ambiguous retry from duplicating.
    console.error('Repair pickup booking could not be confirmed:', error);
    return pickupFailure('shipment_save_failed');
  }

  const { data: bookedShipmentData, error: bookedShipmentError } =
    await supabase
      .from('shipments')
      .update({
        provider: booking.provider,
        provider_shipment_id: booking.providerShipmentId,
        tracking_number: booking.trackingNumber,
        carrier_name: booking.carrierName,
        status: booking.status,
        is_station_pickup: booking.isStationPickup ?? false,
        station_name: booking.pickupStationName ?? null,
        station_address: booking.pickupStationAddress ?? null,
        pickup_scheduled_at: booking.pickupScheduledAt?.toISOString() ?? null,
        label_url: booking.labelUrl ?? null,
        provider_response: booking.rawResponse ?? null,
      })
      .eq('id', shipment.id)
      .eq('merchant_id', merchantId)
      .select('id')
      .single();

  if (bookedShipmentError || !bookedShipmentData) {
    console.error(
      'Repair pickup was booked but the pending shipment could not be finalized:',
      bookedShipmentError
    );
    return pickupFailure('shipment_save_failed');
  }

  const { error: clearLockError } = await supabase
    .from('repairs')
    .update({
      pickup_booking_lock_token: null,
      pickup_booking_started_at: null,
    })
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .eq('shipment_id', shipment.id)
    .eq('pickup_booking_lock_token', claim.lockToken);

  if (clearLockError) {
    // The shipment is safely linked. A stale lock cannot re-open booking while
    // shipment_id remains set, so do not turn a successful booking into a failure.
    console.error(
      'Failed to clear repair pickup booking lock:',
      clearLockError
    );
  }

  const { error: quoteUsedError } = await supabase
    .from('repair_pickup_quotes')
    .update({ used: true })
    .eq('id', quoteRow.id)
    .eq('merchant_id', merchantId);

  if (quoteUsedError) {
    // Non-fatal bookkeeping after the shipment is safely linked.
    console.error('Failed to mark repair pickup quote used:', quoteUsedError);
  }

  return {
    ok: true,
    trackingNumber: booking.trackingNumber,
    carrierName: booking.carrierName,
    shipmentId: shipment.id,
    pickupScheduledAt: booking.pickupScheduledAt?.toISOString() ?? null,
  };
}
