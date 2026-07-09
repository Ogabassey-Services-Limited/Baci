import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type BookRepairPickupResult,
  buildPickupItems,
  buildPickupSender,
  pickupFailure,
} from '@/lib/repairs/pickup-shipment-utils';
import { getRepairCenterAddress } from '@/lib/repairs/repair-center-address';
import { shippingService } from '@/lib/shipping';
import type {
  BookingRequest,
  ShipmentBookingResult,
  ShippingQuote,
} from '@/lib/shipping/types';

const PICKUP_PROVIDER = 'TOPSHIP' as const;
const PICKUP_LOCK_TIMEOUT_SECONDS = 15 * 60;

interface RepairPickupRow {
  id: string;
  merchant_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  device_type: string | null;
  device_model: string | null;
  pickup_address: string | null;
  shipment_id: string | null;
  quoted_price: number | string | null;
}

interface RepairPickupClaimRow {
  claimed: boolean;
  shipment_id: string | null;
}

type RepairPickupClaimResult =
  | { status: 'claimed'; lockToken: string }
  | { status: 'already_booked' }
  | { status: 'booking_in_progress' }
  | { status: 'not_found' }
  | { status: 'failed' };

function cheapestQuote(quotes: ShippingQuote[]): ShippingQuote | null {
  const priced = quotes
    .filter((quote) => quote.price > 0)
    .sort((a, b) => a.price - b.price);
  return priced[0] ?? quotes[0] ?? null;
}

function getClaimRow(
  value: RepairPickupClaimRow[] | RepairPickupClaimRow | null
): RepairPickupClaimRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

async function claimRepairPickupBooking(
  supabase: SupabaseClient,
  merchantId: string,
  repairId: string
): Promise<RepairPickupClaimResult> {
  const lockToken = crypto.randomUUID();
  const { data, error } = await supabase.rpc('claim_repair_pickup_booking', {
    p_repair_id: repairId,
    p_merchant_id: merchantId,
    p_lock_token: lockToken,
    p_lock_timeout_seconds: PICKUP_LOCK_TIMEOUT_SECONDS,
  });

  if (error) {
    console.error('Failed to claim repair pickup booking:', error);
    return { status: 'failed' };
  }

  const row = getClaimRow(
    data as RepairPickupClaimRow[] | RepairPickupClaimRow | null
  );
  if (!row) {
    return { status: 'not_found' };
  }

  if (row.claimed) {
    return { status: 'claimed', lockToken };
  }

  if (row.shipment_id) {
    return { status: 'already_booked' };
  }

  return { status: 'booking_in_progress' };
}

/**
 * Merchant-triggered courier pickup for a repair (reverse logistics).
 *
 * Best-effort by design: Topship needs a funded wallet and covers Lagos/Abuja,
 * so every failure path returns a structured result the dashboard can surface,
 * always allowing "mark pickup arranged manually" for recoverable reasons.
 * Never auto-booked — the caller (dashboard pickup route) invokes this after a
 * repairs.edit permission check with a service-role client scoped to the
 * merchant.
 *
 * Direction: customer pickup address = sender, private repair-center address =
 * receiver. The fresh quote + provider metadata are persisted to the PRIVATE
 * repair_pickup_quotes table before booking. A pending shipment is then
 * persisted and linked to the repair before contacting Topship, so an
 * ambiguous provider or database failure cannot permit a second charge.
 */
export async function bookRepairPickup(
  supabase: SupabaseClient,
  merchantId: string,
  repairId: string
): Promise<BookRepairPickupResult> {
  const { data: repairData, error: repairError } = await supabase
    .from('repairs')
    .select(
      'id, merchant_id, customer_name, customer_email, customer_phone, device_type, device_model, pickup_address, shipment_id, quoted_price'
    )
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  const repair = repairData as RepairPickupRow | null;
  if (repairError || !repair) {
    return pickupFailure('not_found');
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
  const quoteRequest = {
    sessionId: crypto.randomUUID(),
    merchantId,
    shipmentType: 'domestic' as const,
    sender,
    receiver: {
      name: receiver.name,
      phone: receiver.phone,
      email: receiver.email,
      address: receiver.address,
      city: receiver.city,
      state: receiver.state,
      country: receiver.country,
      countryCode: receiver.countryCode,
    },
    items,
  };

  let quote: ShippingQuote | null;
  try {
    const quotes = await shippingService.getProviderQuotes(
      PICKUP_PROVIDER,
      quoteRequest
    );
    quote = cheapestQuote(quotes);
  } catch (error) {
    console.error('Repair pickup quote failed:', error);
    return pickupFailure('topship_unavailable');
  }

  if (!quote) {
    return pickupFailure('topship_unavailable');
  }

  // Persist the quote (with provider metadata + PII request) privately so the
  // booking has the stored charge Topship requires.
  const { data: quoteRowData, error: quoteInsertError } = await supabase
    .from('repair_pickup_quotes')
    .insert({
      merchant_id: merchantId,
      repair_id: repairId,
      provider: PICKUP_PROVIDER,
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
  if (claim.status === 'already_booked') {
    return pickupFailure('already_booked');
  }
  if (claim.status === 'booking_in_progress') {
    return pickupFailure('booking_in_progress');
  }
  if (claim.status === 'failed') {
    return pickupFailure('booking_failed');
  }

  // Reserve a local shipment before calling the provider. Once this is linked
  // to the repair, retries are blocked even if the provider call or later
  // database update has an ambiguous outcome.
  const { data: shipmentData, error: shipmentError } = await supabase
    .from('shipments')
    .insert({
      order_id: null,
      merchant_id: merchantId,
      provider: PICKUP_PROVIDER,
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
      PICKUP_PROVIDER,
      bookingRequest
    );
  } catch (error) {
    // A transport error can occur after Topship accepted the booking. The
    // linked pending shipment prevents a retry from creating a duplicate.
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
    // Non-fatal: the shipment is already booked and linked; a stale `used`
    // flag only affects bookkeeping, so log rather than fail the booking.
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
