import 'server-only';
import { createRepairPickupReceiverClient } from './repair-pickup-receiver-client';

/**
 * The merchant's repair-center address, shaped for use as a shipping receiver
 * (courier pickup) or a display origin. Derived from the PRIVATE
 * `merchant_feature_settings.repair_settings` jsonb column via the
 * storefront-safe `get_repair_pickup_receiver` projection.
 */
export interface RepairCenterAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
}

const REPAIR_PICKUP_RECEIVER_RPC = 'get_repair_pickup_receiver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Reads the merchant's private repair-center address through the published
 * pickup-receiver RPC. The short-lived, merchant-bound client proves that the
 * request came through this server-only boundary without using service role.
 *
 * Returns `null` when pickup is not configured — unpublished store, pickup
 * explicitly disabled, missing phone, or incomplete address/city/state — so
 * callers can fall back to drop-off only. Only prices, never the raw address,
 * should reach the client.
 */
export async function getRepairCenterAddress(
  merchantId: string
): Promise<RepairCenterAddress | null> {
  if (!merchantId) {
    return null;
  }

  const supabase = createRepairPickupReceiverClient(merchantId);
  const { data, error } = await supabase.rpc(REPAIR_PICKUP_RECEIVER_RPC, {
    p_merchant_id: merchantId,
  });

  if (error) {
    console.error('getRepairCenterAddress: query failed', error);
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }

  const address = readNullableString(data.address);
  const city = readNullableString(data.city);
  const state = readNullableString(data.state);
  const phone = readNullableString(data.phone);
  if (!address || !city || !state || !phone) {
    return null;
  }

  return {
    name: readNullableString(data.name) || 'Repair Center',
    phone,
    email: readNullableString(data.email) || undefined,
    address,
    city,
    state,
    country: readNullableString(data.country) || 'Nigeria',
    countryCode: 'NG',
  };
}
