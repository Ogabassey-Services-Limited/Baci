import type {
  MerchantSettingsRecord,
  MerchantSettingsUpdatePayload,
} from '@baci/shared';
import { apiClient } from './api-client';
import { supabase } from './supabase';

interface MerchantSettingsResponse {
  merchant: MerchantSettingsRecord;
}

export function updateMerchantSettings(payload: MerchantSettingsUpdatePayload) {
  return apiClient<MerchantSettingsResponse>('/api/merchant/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export interface MerchantIdentitySettingsPayload {
  business_address?: string | null;
  business_name?: string | null;
  country?: string | null;
  payout_currency?: string | null;
  phone?: string | null;
  slug?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
}

function merchantIdentityUpdateError(message: string): Error {
  if (message.includes('merchant_settings_mfa_required')) {
    return new Error(
      'Multi-factor authentication is required. Verify your second factor in Security, then try again.'
    );
  }

  if (message.includes('merchant_settings_reauthentication_required')) {
    return new Error(
      'For your security, sign out and sign back in before changing store contact details.'
    );
  }

  if (message.includes('merchant_settings_conflict')) {
    return new Error(
      'These settings changed elsewhere. Reopen the page and try again.'
    );
  }

  return new Error(message || 'Failed to update store settings');
}

export async function updateMerchantIdentitySettings(params: {
  expectedUpdatedAt: string;
  merchantId: string;
  settings: MerchantIdentitySettingsPayload;
}): Promise<void> {
  const { error } = await supabase.rpc('update_merchant_identity_settings', {
    p_expected_updated_at: params.expectedUpdatedAt,
    p_merchant_id: params.merchantId,
    p_settings: params.settings,
  });

  if (error) {
    throw merchantIdentityUpdateError(error.message);
  }
}
