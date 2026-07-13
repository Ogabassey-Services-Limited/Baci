import type {
  MerchantSettingsRecord,
  MerchantSettingsUpdatePayload,
} from '@baci/shared';
import { apiClient } from './api-client';

interface MerchantSettingsResponse {
  merchant: MerchantSettingsRecord;
}

export function updateMerchantSettings(payload: MerchantSettingsUpdatePayload) {
  return apiClient<MerchantSettingsResponse>('/api/merchant/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
