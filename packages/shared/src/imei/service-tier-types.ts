export const IMEI_BRAND_FILTERS = [
  { id: 'apple', label: 'Apple' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'xiaomi', label: 'Xiaomi' },
  { id: 'google', label: 'Google' },
  { id: 'oppo', label: 'Oppo' },
  { id: 'tecno', label: 'Tecno' },
] as const;

/** A selectable brand chip. Every phone is a specific brand — there is no "All". */
export type ImeiBrandFilter = (typeof IMEI_BRAND_FILTERS)[number]['id'];

/** A tier's brand applicability; `all` marks universal checks (blacklist, etc.). */
export type ImeiServiceBrandScope = ImeiBrandFilter | 'all';

/** Top-level hardware family the checker groups services under. */
export const IMEI_DEVICE_CATEGORIES = [
  { id: 'smartphone', label: 'Phone', icon: 'phone-portrait-outline' },
  { id: 'tablet', label: 'iPad', icon: 'tablet-landscape-outline' },
  { id: 'laptop', label: 'Mac', icon: 'laptop-outline' },
  { id: 'watch', label: 'Watch', icon: 'watch-outline' },
] as const;

export type ImeiDeviceCategory = (typeof IMEI_DEVICE_CATEGORIES)[number]['id'];

/**
 * Which identifier a service accepts. Sickw's `imei` param is identifier-agnostic
 * (takes an IMEI or an Apple serial), so this drives our input validation only:
 * - `imei`   → 15 numeric digits + Luhn (phones, cellular iPad)
 * - `serial` → 8–14 alphanumeric Apple serial (Mac, Watch, WiFi iPad)
 * - `both`   → accept either
 */
export type ImeiIdentifierType = 'imei' | 'serial' | 'both';

export type ImeiCheckField =
  | 'activationStatus'
  | 'blacklistStatus'
  | 'carrier'
  | 'demoUnit'
  | 'device'
  | 'gsxCoverage'
  | 'icloud'
  | 'knoxGuardStatus'
  | 'miLockStatus'
  | 'miLostStatus'
  | 'mdmStatus'
  | 'modelNumber'
  | 'partNumber'
  | 'purchaseCountry'
  | 'purchaseDate'
  | 'refurbished'
  | 'repairEligibility'
  | 'repairHistory'
  | 'replacementHistory'
  | 'serialNumber'
  | 'simLock'
  | 'verdict'
  | 'warranty';

export type ImeiServiceIconName =
  | 'barcode-outline'
  | 'briefcase-outline'
  | 'build-outline'
  | 'checkmark-circle-outline'
  | 'construct-outline'
  | 'globe-outline'
  | 'hardware-chip-outline'
  | 'information-circle-outline'
  | 'laptop-outline'
  | 'lock-closed-outline'
  | 'phone-portrait-outline'
  | 'refresh-outline'
  | 'shield-checkmark-outline'
  | 'shield-outline'
  | 'sparkles-outline'
  | 'storefront-outline'
  | 'tablet-portrait-outline'
  | 'time-outline'
  | 'watch-outline';

export interface ImeiServiceTierDefinition {
  providerServiceId: string;
  name: string;
  tagline: string;
  description: string;
  detail: string;
  /** Customer-facing price in Nigerian naira. */
  price: number;
  /** Provider cost in USD dollars. */
  costUsd: number;
  features: readonly string[];
  checksIncluded: readonly ImeiCheckField[];
  icon: ImeiServiceIconName;
  recommended?: true;
  brandScopes: readonly ImeiServiceBrandScope[];
  /** Hardware families this service applies to (drives the device tabs). */
  deviceCategories: readonly ImeiDeviceCategory[];
  /** Identifier the service accepts; drives input validation. */
  identifier: ImeiIdentifierType;
}
