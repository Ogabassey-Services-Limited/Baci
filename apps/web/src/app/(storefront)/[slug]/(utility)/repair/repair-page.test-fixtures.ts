import type { getCachedMerchant } from '@/lib/cached-data';

export const enabledMerchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  template_id: 'ogabassey',
  feature_settings: { repairs_catalog_enabled: true },
} as unknown as NonNullable<Awaited<ReturnType<typeof getCachedMerchant>>>;

export const deviceDetail = {
  device: {
    id: 'device-1',
    brand: 'Apple',
    model: 'iPhone 13 Pro Max',
    slug: 'apple-iphone-13-pro-max',
    deviceType: 'Smartphone' as const,
    imageUrl: null,
    productId: null,
  },
  quotes: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      serviceTypeId: 'st-1',
      serviceTypeName: 'Screen Replacement',
      price: 25000,
      isFromPrice: true,
      partQuality: null,
      turnaround: null,
      warrantyDays: null,
      description: null,
    },
  ],
  product: null,
};
