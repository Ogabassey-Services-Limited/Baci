import { vi } from 'vitest';
import type { Merchant } from '@/hooks/useMerchant';
import type { MerchantIdentitySettingsReceipt } from '@/lib/merchant-settings';
import { mocks } from './store-settings.test-mocks';

export const defaultMerchant = {
  bank_account_name: null,
  bank_account_number: null,
  bank_code: null,
  bank_name: null,
  bvn: null,
  id: 'merchant-1',
  user_id: 'user-store-settings-owner',
  business_address: '12 Allen Avenue',
  business_name: 'Baci Foods',
  cac_rc_number: null,
  country: 'NG',
  email: 'support@usebaci.com',
  facebook_pixel_id: null,
  favicon_png_192_url: null,
  google_analytics_id: null,
  hero_slides: null,
  is_published: false,
  legal_entity_name: null,
  logo_url: 'https://example.com/logo.png',
  payout_currency: 'NGN',
  paystack_subaccount_code: null,
  phone: '+2348012345678',
  plan_tier: 'free',
  premium_features: [],
  nin: null,
  slug: 'baci-foods',
  social_media: {},
  support_email: 'support@usebaci.com',
  support_phone: '+2347000000000',
  tax_identification_number: null,
  tiktok_pixel_id: null,
  twitter_pixel_id: null,
  updated_at: '2026-06-17T08:00:00.000Z',
  vat_rate: null,
  vat_registration_status: 'not_registered',
  snapchat_pixel_id: null,
} satisfies Merchant;

export const defaultStoreSettingsSaveReceipt = {
  merchantId: defaultMerchant.id,
  savedValues: {
    business_address: defaultMerchant.business_address,
    business_name: defaultMerchant.business_name,
    country: defaultMerchant.country,
    payout_currency: defaultMerchant.payout_currency,
    phone: defaultMerchant.phone,
    slug: defaultMerchant.slug,
    support_email: defaultMerchant.support_email,
    support_phone: defaultMerchant.support_phone,
  },
  updatedAt: '2026-07-31T10:00:00.000Z',
} satisfies MerchantIdentitySettingsReceipt;

type StoreSettingsReceiptValues =
  typeof defaultStoreSettingsSaveReceipt.savedValues;

export function resetStoreSettingsMocks() {
  vi.clearAllMocks();
  mocks.routeParams = {};
  mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
  mocks.updateMerchantIdentitySettings.mockImplementation(
    ({
      merchantId,
      settings,
    }: {
      merchantId: string;
      settings: Partial<StoreSettingsReceiptValues>;
    }) =>
      Promise.resolve({
        ...defaultStoreSettingsSaveReceipt,
        merchantId,
        savedValues: {
          ...defaultStoreSettingsSaveReceipt.savedValues,
          ...settings,
        },
      })
  );
  mocks.useMerchant.mockReturnValue({
    merchant: defaultMerchant,
    isLoading: false,
  });
}
