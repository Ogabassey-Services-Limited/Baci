import { describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { uploadLogoWithColors } from './settings-logo-upload';

const { extractColorsFromImage, uploadImage } = vi.hoisted(() => ({
  extractColorsFromImage: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock('./settings-utils', () => ({ extractColorsFromImage }));
vi.mock('@/lib/storage', () => ({ uploadImage }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const merchant: CachedMerchant = {
  id: 'merchant-1',
  business_name: 'Baci',
  site_title: 'Baci',
  site_tagline: '',
  site_description: '',
  business_type: 'FASHION',
  logo_url: 'https://cdn.example/old.png',
  phone: '',
  email: '',
  slug: 'baci',
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'free',
  premium_features: null,
  brand_colors: { primary: '#000', background: '#fff', accent: '#f00' },
  country: 'NG',
  hero_slides: [],
  mobile_hero_slides: [],
  social_media: {},
};

describe('uploadLogoWithColors', () => {
  it('persists the uploaded URL and extracted colors after previewing the data URI', async () => {
    const setMerchantState = vi.fn();
    const setIsUploading = vi.fn();
    const updateMerchant = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();
    const startTransition = vi.fn((callback: () => void) => callback());
    const colors = { primary: '#111', background: '#222', accent: '#333' };
    extractColorsFromImage.mockResolvedValueOnce(colors);
    uploadImage.mockResolvedValueOnce('https://cdn.example/new.png');

    await uploadLogoWithColors({
      dataUri: 'data:image/png;base64,new',
      merchantId: 'merchant-1',
      previousState: merchant,
      updateMerchant,
      toast,
      setMerchantState,
      setIsUploading,
      startTransition,
    });

    expect(updateMerchant).toHaveBeenCalledWith(
      {
        logo_url: 'https://cdn.example/new.png',
        brand_colors: colors,
      },
      { merchantId: 'merchant-1', skipReload: true }
    );
    expect(toast).toHaveBeenCalledWith({
      title: 'Logo and Colors Updated!',
      description: 'Your new brand identity is saved.',
    });
    expect(setIsUploading).toHaveBeenNthCalledWith(1, true);
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
  });

  it('restores the prior merchant and reports the upload failure', async () => {
    const setMerchantState = vi.fn();
    const setIsUploading = vi.fn();
    const updateMerchant = vi.fn();
    const toast = vi.fn();
    const startTransition = vi.fn((callback: () => void) => callback());
    extractColorsFromImage.mockResolvedValueOnce(merchant.brand_colors);
    uploadImage.mockResolvedValueOnce(null);

    await uploadLogoWithColors({
      dataUri: 'data:image/png;base64,new',
      merchantId: 'merchant-1',
      previousState: merchant,
      updateMerchant,
      toast,
      setMerchantState,
      setIsUploading,
      startTransition,
    });

    expect(setMerchantState).toHaveBeenCalledWith(merchant);
    expect(toast).toHaveBeenCalledWith({
      title: 'Update Failed',
      description: 'Failed to upload logo to storage.',
      variant: 'destructive',
    });
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
  });
});
