import {
  type ImeiBrandFilter,
  type ImeiDeviceCategory,
  type ImeiServiceTierKey,
  PUBLIC_IMEI_SERVICE_TIERS,
  getVisibleImeiServiceTierKeysForDevice,
} from '@baci/shared/imei';

const PUBLIC_IMEI_SERVICE_TIER_KEYS = new Set<ImeiServiceTierKey>(
  PUBLIC_IMEI_SERVICE_TIERS
);

/**
 * Device+brand-scoped tier keys, further intersected with
 * PUBLIC_IMEI_SERVICE_TIERS so a future catalog-only (non-purchasable) tier
 * never surfaces in the picker. App-local (not shared) — mirrors mobile's
 * equivalent wrapper in apps/mobile-storefront/.../resolve-imei-check-failure.ts
 * so both clients apply the identical purchasable filter.
 */
export function getVisibleWebImeiServiceTierKeys(
  category: ImeiDeviceCategory,
  brand: ImeiBrandFilter,
  expanded: boolean
): ImeiServiceTierKey[] {
  return getVisibleImeiServiceTierKeysForDevice(
    category,
    brand,
    expanded
  ).filter((tierKey) => PUBLIC_IMEI_SERVICE_TIER_KEYS.has(tierKey));
}

/** True when expanding "show all services" would reveal extra purchasable checks. */
export function hasAdditionalWebImeiServiceTierKeys(
  category: ImeiDeviceCategory,
  brand: ImeiBrandFilter
): boolean {
  const collapsed = getVisibleWebImeiServiceTierKeys(category, brand, false);
  const expanded = getVisibleWebImeiServiceTierKeys(category, brand, true);
  return expanded.some((tierKey) => !collapsed.includes(tierKey));
}
