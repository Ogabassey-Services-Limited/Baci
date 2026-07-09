import { getMerchantByIdentifier } from '@/lib/cached-data';
import { isRepairsCatalogEnabled } from '@/lib/repairs/repairs-feature';

export interface RepairsCatalogMerchant {
  merchantId: string;
  enabled: boolean;
}

/**
 * Resolves a storefront slug or custom domain to its merchant id and whether
 * the repairs catalogue is publicly enabled (electronics/gadgets business type
 * + flag on). The catalogue RLS enforces the same gate, but the read APIs 404
 * early when the feature is off. Returns null when the merchant does not exist.
 */
export async function resolveRepairsCatalogMerchant(
  slug: string
): Promise<RepairsCatalogMerchant | null> {
  const merchant = await getMerchantByIdentifier(slug);
  if (!merchant) {
    return null;
  }

  const enabled = isRepairsCatalogEnabled({
    businessType: merchant.business_type,
    repairsCatalogEnabled: merchant.feature_settings?.repairs_catalog_enabled,
  });

  return { merchantId: merchant.id, enabled };
}
