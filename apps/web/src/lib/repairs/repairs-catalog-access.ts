import { getMerchantByIdentifier } from '@/lib/cached-data';
import { isRepairsCatalogEnabled } from '@/lib/repairs/repairs-feature';

export interface RepairsCatalogMerchant {
  merchantId: string;
  enabled: boolean;
}

/**
 * Resolves a storefront slug or custom domain to its merchant id and whether
 * the repairs catalogue is publicly enabled (store PUBLISHED + electronics/
 * gadgets business type + flag on). This must match the SQL gate
 * `repairs_catalog_publicly_enabled` (which requires `m.is_published`) so the
 * read APIs 404 for a draft store instead of returning a 200 with an empty
 * catalogue that RLS hid — the mobile fallback relies on that 404. Returns null
 * when the merchant does not exist.
 */
export async function resolveRepairsCatalogMerchant(
  slug: string
): Promise<RepairsCatalogMerchant | null> {
  const merchant = await getMerchantByIdentifier(slug);
  if (!merchant) {
    return null;
  }

  const enabled =
    merchant.is_published === true &&
    isRepairsCatalogEnabled({
      businessType: merchant.business_type,
      repairsCatalogEnabled: merchant.feature_settings?.repairs_catalog_enabled,
    });

  return { merchantId: merchant.id, enabled };
}
