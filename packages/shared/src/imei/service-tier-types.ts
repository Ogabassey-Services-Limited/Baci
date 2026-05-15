export const IMEI_BRAND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'apple', label: 'Apple' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'android', label: 'Android' },
] as const;

export type ImeiBrandFilter = (typeof IMEI_BRAND_FILTERS)[number]['id'];
export type ImeiServiceBrandScope = ImeiBrandFilter;

export type ImeiCheckField =
  | 'activationStatus'
  | 'blacklistStatus'
  | 'carrier'
  | 'demoUnit'
  | 'device'
  | 'icloud'
  | 'miLockStatus'
  | 'miLostStatus'
  | 'mdmStatus'
  | 'modelNumber'
  | 'purchaseCountry'
  | 'purchaseDate'
  | 'refurbished'
  | 'serialNumber'
  | 'simLock'
  | 'verdict'
  | 'warranty';

export type ImeiServiceIconName =
  | 'barcode-outline'
  | 'briefcase-outline'
  | 'checkmark-circle-outline'
  | 'globe-outline'
  | 'information-circle-outline'
  | 'lock-closed-outline'
  | 'phone-portrait-outline'
  | 'refresh-outline'
  | 'shield-checkmark-outline'
  | 'shield-outline'
  | 'sparkles-outline'
  | 'storefront-outline';

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
}
