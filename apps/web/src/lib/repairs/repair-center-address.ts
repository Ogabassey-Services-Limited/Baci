import { createClient } from '@/lib/supabase/admin';
import { repairSettingsSchema } from '@/schemas/merchant-features';

/**
 * The merchant's repair-center address, shaped for use as a shipping receiver
 * (courier pickup) or a display origin. Derived from the PRIVATE
 * `merchant_feature_settings.repair_settings` jsonb column.
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

/**
 * Reads the merchant's private repair-center address via the service-role
 * client. Server-only: `repair_settings` is deliberately excluded from every
 * public feature projection, so only booking/pickup/quoting code touches it.
 *
 * Returns `null` when pickup is not configured — pickup explicitly disabled, or
 * the address/city/state are incomplete — so callers can fall back to drop-off
 * only ("the store will contact you to arrange pickup"). Only prices, never the
 * raw address, should reach the client.
 */
export async function getRepairCenterAddress(
  merchantId: string
): Promise<RepairCenterAddress | null> {
  if (!merchantId) {
    return null;
  }

  const admin = createClient();
  const { data, error } = await admin
    .from('merchant_feature_settings')
    .select('repair_settings')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const raw = (data as { repair_settings: unknown }).repair_settings;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const parsed = repairSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const settings = parsed.data;
  if (settings.pickup_enabled === false) {
    return null;
  }

  const address = settings.pickup_address?.trim();
  const city = settings.city?.trim();
  const state = settings.state?.trim();
  if (!address || !city || !state) {
    return null;
  }

  return {
    name: settings.contact_name?.trim() || 'Repair Center',
    phone: settings.contact_phone?.trim() || '',
    email: settings.contact_email?.trim() || undefined,
    address,
    city,
    state,
    country: settings.country?.trim() || 'Nigeria',
    countryCode: 'NG',
  };
}
