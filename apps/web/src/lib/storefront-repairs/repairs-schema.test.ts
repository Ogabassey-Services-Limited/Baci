import type {
  RepairDeviceBrandGroup,
  RepairDeviceDetail,
} from '@baci/shared/repairs';
import { describe, expect, it } from 'vitest';
import {
  buildRepairsDeviceSchema,
  buildRepairsIndexSchema,
} from './repairs-schema';

const baseDetail: RepairDeviceDetail = {
  device: {
    id: 'device-1',
    brand: 'Apple',
    model: 'iPhone 13',
    slug: 'apple-iphone-13',
    deviceType: 'Smartphone',
    imageUrl: 'https://cdn.example.com/iphone-13.jpg',
    productId: 'product-1',
  },
  quotes: [
    {
      id: 'quote-1',
      serviceTypeId: 'type-1',
      serviceTypeName: 'Screen Replacement',
      price: 25000,
      isFromPrice: true,
      partQuality: 'OEM',
      turnaround: '2 hours',
      warrantyDays: 90,
      description: 'Genuine OEM screen',
    },
    {
      id: 'quote-2',
      serviceTypeId: 'type-2',
      serviceTypeName: 'Battery Replacement',
      price: 12000,
      isFromPrice: false,
      partQuality: null,
      turnaround: null,
      warrantyDays: null,
      description: null,
    },
  ],
  product: {
    id: 'product-1',
    slug: 'apple-iphone-13',
    name: 'Apple iPhone 13',
    imageUrl: 'https://cdn.example.com/product-1.jpg',
    keySpecs: [{ label: 'RAM', value: '4GB' }],
  },
};

describe('buildRepairsDeviceSchema', () => {
  it('returns null when the device has no active quotes', () => {
    const schema = buildRepairsDeviceSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      deviceUrl: 'https://ogabassey.com/repairs/apple-iphone-13',
      detail: { ...baseDetail, quotes: [] },
      currency: 'NGN',
    });

    expect(schema).toBeNull();
  });

  it('builds an OfferCatalog of Service nodes with a shared provider @id', () => {
    const schema = buildRepairsDeviceSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      deviceUrl: 'https://ogabassey.com/repairs/apple-iphone-13',
      detail: baseDetail,
      currency: 'NGN',
      areaServed: 'Nigeria',
    });

    expect(schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      '@id': 'https://ogabassey.com/repairs/apple-iphone-13#repair-catalog',
      name: 'Apple iPhone 13 repair services',
      url: 'https://ogabassey.com/repairs/apple-iphone-13',
      provider: {
        '@type': 'Organization',
        '@id': 'https://ogabassey.com/#online-store',
        name: 'Ogabassey',
      },
    });

    const items = (schema as unknown as { itemListElement: unknown[] })
      .itemListElement;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      '@type': 'Service',
      '@id': 'https://ogabassey.com/repairs/apple-iphone-13#repair-quote-1',
      name: 'Apple iPhone 13 Screen Replacement',
      serviceType: 'Screen Replacement',
      provider: { '@id': 'https://ogabassey.com/#online-store' },
      areaServed: { '@type': 'Country', name: 'Nigeria' },
      description: 'Genuine OEM screen',
    });
  });

  it('emits a PriceSpecification.minPrice for from-price quotes and a fixed price otherwise', () => {
    const schema = buildRepairsDeviceSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      deviceUrl: 'https://ogabassey.com/repairs/apple-iphone-13',
      detail: baseDetail,
      currency: 'NGN',
    });

    const [fromPriceService, fixedPriceService] = (
      schema as unknown as {
        itemListElement: Array<{ offers: Record<string, unknown> }>;
      }
    ).itemListElement;

    expect(fromPriceService.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'NGN',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'NGN',
        minPrice: 25000,
      },
    });
    expect(fromPriceService.offers.price).toBeUndefined();

    expect(fixedPriceService.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'NGN',
      price: 12000,
    });
    expect(fixedPriceService.offers.priceSpecification).toBeUndefined();
  });

  it('links each Service to the linked product PDP via isRelatedTo', () => {
    const schema = buildRepairsDeviceSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      deviceUrl: 'https://ogabassey.com/repairs/apple-iphone-13',
      detail: baseDetail,
      currency: 'NGN',
    });

    const [service] = (
      schema as unknown as {
        itemListElement: Array<{ isRelatedTo?: Record<string, unknown> }>;
      }
    ).itemListElement;

    expect(service.isRelatedTo).toEqual({
      '@type': 'Product',
      '@id': 'https://ogabassey.com/products/apple-iphone-13',
      url: 'https://ogabassey.com/products/apple-iphone-13',
      name: 'Apple iPhone 13',
    });
  });

  it('omits isRelatedTo when the device has no linked product', () => {
    const schema = buildRepairsDeviceSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      deviceUrl: 'https://ogabassey.com/repairs/apple-iphone-13',
      detail: {
        ...baseDetail,
        device: { ...baseDetail.device, productId: null },
        product: null,
      },
      currency: 'NGN',
    });

    const [service] = (
      schema as unknown as {
        itemListElement: Array<{ isRelatedTo?: unknown }>;
      }
    ).itemListElement;

    expect(service.isRelatedTo).toBeUndefined();
  });
});

describe('buildRepairsIndexSchema', () => {
  const groups: RepairDeviceBrandGroup[] = [
    {
      brand: 'Apple',
      devices: [
        {
          id: 'd1',
          brand: 'Apple',
          model: 'iPhone 13',
          slug: 'apple-iphone-13',
          deviceType: 'Smartphone',
          imageUrl: null,
          productId: null,
        },
      ],
    },
    {
      brand: 'Samsung',
      devices: [
        {
          id: 'd2',
          brand: 'Samsung',
          model: 'Galaxy S23',
          slug: 'samsung-galaxy-s23',
          deviceType: 'Smartphone',
          imageUrl: null,
          productId: null,
        },
      ],
    },
  ];

  it('returns null when there are no devices', () => {
    expect(
      buildRepairsIndexSchema({
        merchantName: 'Ogabassey',
        storeBaseUrl: 'https://ogabassey.com',
        repairsUrl: 'https://ogabassey.com/repairs',
        groups: [],
      })
    ).toBeNull();
  });

  it('builds an ItemList of device repair pages', () => {
    const schema = buildRepairsIndexSchema({
      merchantName: 'Ogabassey',
      storeBaseUrl: 'https://ogabassey.com',
      repairsUrl: 'https://ogabassey.com/repairs',
      groups,
    });

    expect(schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': 'https://ogabassey.com/repairs#repair-devices',
      url: 'https://ogabassey.com/repairs',
      numberOfItems: 2,
    });

    expect(
      (schema as unknown as { itemListElement: unknown[] }).itemListElement
    ).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Apple iPhone 13',
        item: 'https://ogabassey.com/repairs/apple-iphone-13',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Samsung Galaxy S23',
        item: 'https://ogabassey.com/repairs/samsung-galaxy-s23',
      },
    ]);
  });
});
