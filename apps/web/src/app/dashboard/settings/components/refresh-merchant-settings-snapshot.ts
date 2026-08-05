import { logger } from '@/lib/logger';
import {
  getMerchantSettingsSnapshot,
  type MerchantSettingsSnapshot,
} from './get-merchant-settings-snapshot';

export async function refreshMerchantSettingsSnapshot(
  merchantId: string
): Promise<MerchantSettingsSnapshot | undefined> {
  try {
    return await getMerchantSettingsSnapshot(merchantId);
  } catch (error) {
    logger.error({
      error: error as Error,
      message: 'Profile baseline refresh failed',
    });
  }
}
