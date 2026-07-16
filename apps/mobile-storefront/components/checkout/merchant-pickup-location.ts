import type { RegisteredAddress } from '@baci/shared/contracts';

export const MERCHANT_PICKUP_QUOTE_ID = 'merchant-office-pickup';

export interface MerchantPickupLocation {
  address: string;
  city: string;
  label: string;
  state: string;
}

interface MerchantPickupSource {
  business_address?: string | null;
  business_name?: string | null;
  registered_address?: RegisteredAddress | null;
}

function getAddressGeography(address: string): {
  city: string;
  state: string;
} | null {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  return {
    city: parts.at(-2) ?? '',
    state: parts.at(-1) ?? '',
  };
}

export function getMerchantPickupLocation(
  merchant: MerchantPickupSource | null | undefined
): MerchantPickupLocation | undefined {
  const address =
    merchant?.business_address?.trim() ||
    merchant?.registered_address?.street?.trim();
  const addressGeography = address ? getAddressGeography(address) : null;
  const city =
    merchant?.registered_address?.city?.trim() || addressGeography?.city;
  const state =
    merchant?.registered_address?.state?.trim() || addressGeography?.state;
  if (!merchant || !address || !city || !state) return undefined;

  return {
    address,
    city,
    label: `${merchant.business_name?.trim() || 'Merchant'} Office`,
    state,
  };
}
