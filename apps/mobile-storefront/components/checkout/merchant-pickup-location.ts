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

export function getMerchantPickupLocation(
  merchant: MerchantPickupSource | null | undefined
): MerchantPickupLocation | undefined {
  const address = merchant?.business_address?.trim();
  const city = merchant?.registered_address?.city?.trim();
  const state = merchant?.registered_address?.state?.trim();
  if (!merchant || !address || !city || !state) return undefined;

  return {
    address,
    city,
    label: `${merchant.business_name?.trim() || 'Merchant'} Office`,
    state,
  };
}
