/**
 * Repairs catalogue gating.
 *
 * The catalogue is available when the merchant sells electronics/gadgets AND has
 * the repairs_catalog_enabled feature flag on. The business-type predicate mirrors
 * the SQL RLS helper (repairs_catalog_publicly_enabled) exactly:
 * `lower(business_type) IN ('electronics', 'gadgets')` — legacy uppercase/GADGETS
 * values still count, matching the app's business-type normalization.
 */

export const REPAIRS_CATALOG_BUSINESS_TYPES = [
  'electronics',
  'gadgets',
] as const;

export function isRepairsBusinessType(businessType?: string | null): boolean {
  if (!businessType) {
    return false;
  }

  const normalized = businessType.trim().toLowerCase();
  return (REPAIRS_CATALOG_BUSINESS_TYPES as readonly string[]).includes(
    normalized
  );
}

export interface RepairsCatalogGateInput {
  businessType?: string | null;
  repairsCatalogEnabled?: boolean | null;
}

export function isRepairsCatalogEnabled({
  businessType,
  repairsCatalogEnabled,
}: RepairsCatalogGateInput): boolean {
  return repairsCatalogEnabled === true && isRepairsBusinessType(businessType);
}
