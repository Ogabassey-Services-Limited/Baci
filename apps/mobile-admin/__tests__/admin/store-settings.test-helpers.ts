import { vi } from 'vitest';
import { mocks } from './store-settings.test-mocks';

export const defaultMerchant = {
  id: 'merchant-1',
  business_address: '12 Allen Avenue',
  business_name: 'Baci Foods',
  country: 'NG',
  email: 'support@usebaci.com',
  logo_url: 'https://example.com/logo.png',
  payout_currency: 'NGN',
  phone: '+2348012345678',
  slug: 'baci-foods',
  support_email: 'support@usebaci.com',
  support_phone: '+2347000000000',
  updated_at: '2026-06-17T08:00:00.000Z',
};

export function resetStoreSettingsMocks() {
  vi.clearAllMocks();
  mocks.routeParams = {};
  mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
  mocks.updateMerchantIdentitySettings.mockResolvedValue(undefined);
  mocks.useMerchant.mockReturnValue({
    merchant: defaultMerchant,
    isLoading: false,
  });
}
