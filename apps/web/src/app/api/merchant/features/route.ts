import {
  revalidateFeatures,
  revalidateMerchant,
  revalidateRepairsCatalog,
} from '@/lib/cache-revalidation';
import type { MerchantFeatureCacheRevalidator } from './feature-settings-handler-utils';
import { getFeatureSettings } from './get-feature-settings';
import { createPatchFeatureSettings } from './patch-feature-settings';
import { createPutFeatureSettings } from './put-feature-settings';

const revalidateMerchantFeatureCaches: MerchantFeatureCacheRevalidator = (
  merchantId,
  updates
) => {
  revalidateFeatures(merchantId);
  revalidateMerchant(merchantId);
  if ('repairs_catalog_enabled' in updates) {
    revalidateRepairsCatalog(merchantId);
  }
};

export const GET = getFeatureSettings;
export const PATCH = createPatchFeatureSettings(
  revalidateMerchantFeatureCaches
);
export const PUT = createPutFeatureSettings(revalidateMerchantFeatureCaches);
