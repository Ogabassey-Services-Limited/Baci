/**
 * Repair booking push + email notifications.
 *
 * Mirrors lib/negotiation-notifications.ts: notify the merchant of a new
 * repair booking and email the customer a ticket confirmation. Both sends
 * are best-effort — a notification/email failure must never fail the
 * booking itself, so every external call is individually caught and logged.
 */

import {
  getCachedMerchantById,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import {
  generateRepairConfirmationEmail,
  generateRepairConfirmationText,
} from '@/lib/email-templates';
import { notifyMerchant } from '@/lib/expo-push';
import { createClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/zeptomail';

export interface NotifyRepairBookingParams {
  merchantId: string;
  repairId: string;
  ticketNumber: number;
  customerName: string;
  customerEmail: string;
  deviceType: string;
  deviceModel: string;
  serviceType: 'dropoff' | 'pickup';
  pickupAddress?: string | null;
  /** Present only when the booking is linked to a catalogue quote. */
  quoteId?: string | null;
}

interface QuoteDisplaySnapshot {
  price: number;
  isFromPrice: boolean;
  serviceTypeName: string | null;
}

interface RepairDeviceSnapshot {
  deviceType: string;
  deviceModel: string;
}

async function resolveRepairDeviceSnapshot(
  merchantId: string,
  repairId: string
): Promise<RepairDeviceSnapshot | null> {
  try {
    const supabase = createClient();
    const { data: repair, error } = await supabase
      .from('repairs')
      .select('device_type, device_model')
      .eq('id', repairId)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error || !repair) {
      return null;
    }

    const row = repair as { device_type: unknown; device_model: unknown };
    const deviceType =
      typeof row.device_type === 'string' ? row.device_type.trim() : '';
    const deviceModel =
      typeof row.device_model === 'string' ? row.device_model.trim() : '';

    return deviceType && deviceModel ? { deviceType, deviceModel } : null;
  } catch (error) {
    console.error('Error resolving repair device snapshot:', error);
    return null;
  }
}

/**
 * Best-effort lookup of a quote's display price + service type name, used
 * purely to enrich notification/email copy. Never trusted for the booking
 * write itself (that snapshot happens server-side inside the booking RPC).
 */
async function resolveQuoteSnapshot(
  merchantId: string,
  quoteId: string
): Promise<QuoteDisplaySnapshot | null> {
  try {
    const supabase = getPublicSupabaseClient();
    const { data: quote, error: quoteError } = await supabase
      .from('repair_quotes')
      .select('price, is_from_price, service_type_id')
      .eq('id', quoteId)
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .maybeSingle();

    if (quoteError || !quote) {
      return null;
    }

    const quoteRow = quote as {
      price: unknown;
      is_from_price: unknown;
      service_type_id: unknown;
    };

    let serviceTypeName: string | null = null;
    if (typeof quoteRow.service_type_id === 'string') {
      const { data: serviceType } = await supabase
        .from('repair_service_types')
        .select('name')
        .eq('id', quoteRow.service_type_id)
        .eq('merchant_id', merchantId)
        .maybeSingle();
      serviceTypeName =
        serviceType &&
        typeof (serviceType as { name: unknown }).name === 'string'
          ? (serviceType as { name: string }).name
          : null;
    }

    const price = Number(quoteRow.price);
    if (!Number.isFinite(price)) {
      return null;
    }

    return {
      price,
      isFromPrice: quoteRow.is_from_price !== false,
      serviceTypeName,
    };
  } catch (error) {
    console.error('Error resolving repair quote snapshot:', error);
    return null;
  }
}

function buildDeviceLabel(deviceType: string, deviceModel: string): string {
  return `${deviceType} — ${deviceModel}`;
}

/**
 * Notify the merchant (push) and the customer (email) of a new repair
 * booking. Called at the end of the `createRepair` server action once the
 * booking RPC has already succeeded.
 */
export async function notifyRepairBooking(
  params: NotifyRepairBookingParams
): Promise<void> {
  const [quoteSnapshot, deviceSnapshot] = await Promise.all([
    params.quoteId
      ? resolveQuoteSnapshot(params.merchantId, params.quoteId)
      : Promise.resolve(null),
    resolveRepairDeviceSnapshot(params.merchantId, params.repairId),
  ]);
  const deviceType = deviceSnapshot?.deviceType ?? params.deviceType;
  const deviceModel = deviceSnapshot?.deviceModel ?? params.deviceModel;
  const deviceLabel = buildDeviceLabel(deviceType, deviceModel);

  const pushBody = quoteSnapshot?.serviceTypeName
    ? `${deviceModel} — ${quoteSnapshot.serviceTypeName} (Ticket #${params.ticketNumber})`
    : `${deviceLabel} (Ticket #${params.ticketNumber})`;

  try {
    await notifyMerchant(
      params.merchantId,
      '🔧 New repair booking',
      pushBody,
      { type: 'repair', repair_id: params.repairId },
      'orders'
    );
  } catch (error) {
    console.error('Error sending repair booking push notification:', error);
  }

  try {
    const merchant = await getCachedMerchantById(params.merchantId).catch(
      () => null
    );
    const merchantName = merchant?.business_name || 'the store';
    const currency = merchant?.payout_currency || 'NGN';

    const emailData = {
      ticketNumber: params.ticketNumber,
      customerName: params.customerName,
      merchantName,
      deviceLabel,
      repairTypeLabel: quoteSnapshot?.serviceTypeName ?? null,
      quotedPrice: quoteSnapshot?.price ?? null,
      isFromPrice: quoteSnapshot?.isFromPrice,
      serviceType: params.serviceType,
      pickupAddress: params.pickupAddress ?? null,
      currency,
    };

    const result = await sendEmail({
      auditContext: {
        merchantId: params.merchantId,
        metadata: {
          repairId: params.repairId,
          ticketNumber: params.ticketNumber,
        },
      },
      emailType: 'orders',
      htmlContent: generateRepairConfirmationEmail(emailData),
      merchantId: params.merchantId,
      subject: `Repair request received — Ticket #${params.ticketNumber}`,
      textContent: generateRepairConfirmationText(emailData),
      to: params.customerEmail,
      toName: params.customerName,
    });

    if (!result.success) {
      console.error('Error sending repair confirmation email:', result.error);
    }
  } catch (error) {
    console.error('Error sending repair confirmation email:', error);
  }
}
