import { ANDROID_IMEI_SERVICE_TIERS } from './service-tier-android';
import { APPLE_IMEI_SERVICE_TIERS } from './service-tier-apple';
import { CORE_IMEI_SERVICE_TIERS } from './service-tier-core';
import type {
  ImeiBrandFilter,
  ImeiServiceBrandScope,
} from './service-tier-types';

export * from './service-tier-types';

export const IMEI_SERVICE_TIERS = {
  ...CORE_IMEI_SERVICE_TIERS,
  ...APPLE_IMEI_SERVICE_TIERS,
  ...ANDROID_IMEI_SERVICE_TIERS,
} as const;

export type ImeiServiceTierKey = keyof typeof IMEI_SERVICE_TIERS;

export const PRIMARY_IMEI_SERVICE_TIERS = [
  'full',
  'activation',
  'blacklist',
  'carrier',
] as const satisfies readonly ImeiServiceTierKey[];

export const ALL_IMEI_SERVICE_TIERS = [
  'full',
  'activation',
  'blacklist',
  'blacklistPro',
  'carrier',
  'simLock',
  'icloud',
  'icloudPro',
  'carrierFmi',
  'basic',
  'appleBasic',
  'demoUnit',
  'mdm',
  'samsung',
  'samsungPro',
  'miLock',
  'miLostPro',
  'pixel',
  'oppoRealme',
  'transsion',
] as const satisfies readonly ImeiServiceTierKey[];

export function isImeiServiceTierKey(
  value: unknown
): value is ImeiServiceTierKey {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(IMEI_SERVICE_TIERS, value)
  );
}

export function imeiTierMatchesBrand(
  tierKey: ImeiServiceTierKey,
  brand: ImeiBrandFilter
): boolean {
  const scopes: readonly ImeiServiceBrandScope[] =
    IMEI_SERVICE_TIERS[tierKey].brandScopes;
  return brand === 'all' || scopes.includes('all') || scopes.includes(brand);
}

export function getVisibleImeiServiceTierKeys(
  brand: ImeiBrandFilter,
  expanded: boolean
): ImeiServiceTierKey[] {
  const baseTiers = expanded
    ? ALL_IMEI_SERVICE_TIERS
    : PRIMARY_IMEI_SERVICE_TIERS;
  return baseTiers.filter((tierKey) => imeiTierMatchesBrand(tierKey, brand));
}
