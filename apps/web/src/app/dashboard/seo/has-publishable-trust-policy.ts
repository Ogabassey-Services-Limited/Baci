import {
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { MerchantTrustProfile } from '@/lib/storefront-trust/merchant-trust-profile-types';

export function hasPublishableTrustPolicy(
  trustProfile: Pick<
    MerchantTrustProfile,
    'returnPolicy' | 'shippingPolicy' | 'warrantyPolicy'
  >
): boolean {
  return (
    hasPublishableReturnsPolicy(trustProfile) ||
    hasPublishableShippingPolicy(trustProfile) ||
    hasPublishableWarrantyPolicy(trustProfile)
  );
}
