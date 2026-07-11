import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

const {
  mockHeaders,
  mockRepairDeviceDetailView,
  mockGetRepairDeviceDetailBySlug,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
  mockRepairDeviceDetailView: vi.fn(),
  mockGetRepairDeviceDetailBySlug: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/components/storefront/repairs/RepairDeviceDetailView', () => ({
  RepairDeviceDetailView: (props: Record<string, unknown>) => {
    mockRepairDeviceDetailView(props);
    return <section aria-label="Device detail" />;
  },
}));

vi.mock('@/lib/repairs/repairs-catalog-data', () => ({
  getRepairDeviceDetailBySlug: (...args: unknown[]) =>
    mockGetRepairDeviceDetailBySlug(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: (value: string) => value.length > 0,
}));

const enabledMerchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  custom_domain: 'ogabassey.com',
  slug: 'ogabassey',
  template_id: 'ogabassey',
  payout_currency: 'NGN',
  feature_settings: { repairs_catalog_enabled: true },
} as unknown as NonNullable<Awaited<ReturnType<typeof getCachedMerchant>>>;

const deviceDetail = {
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
      id: 'quote-1',
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

const { default: RepairDeviceDetailPage, generateMetadata } = await import(
  './page'
);

describe('RepairDeviceDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockRepairDeviceDetailView.mockClear();
    mockGetRepairDeviceDetailBySlug.mockReset();
    vi.mocked(getCachedMerchant).mockResolvedValue(enabledMerchant);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(enabledMerchant);
    mockGetRepairDeviceDetailBySlug.mockResolvedValue(deviceDetail);
  });

  it('renders the device detail view with the resolved device data', async () => {
    render(
      await RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          deviceSlug: 'apple-iphone-13-pro-max',
        }),
      })
    );

    expect(
      screen.getByRole('region', { name: /device detail/i })
    ).toBeInTheDocument();
    expect(mockGetRepairDeviceDetailBySlug).toHaveBeenCalledWith(
      'merchant-1',
      'apple-iphone-13-pro-max'
    );
    expect(mockRepairDeviceDetailView).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: deviceDetail,
        currency: 'NGN',
      })
    );
  });

  it('resolves the device detail through the custom-domain merchant lookup', async () => {
    render(
      await RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          deviceSlug: 'apple-iphone-13-pro-max',
        }),
      })
    );

    expect(getCachedMerchantByDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(getCachedMerchant).not.toHaveBeenCalled();
  });

  it('emits an additive OfferCatalog JSON-LD of repair Service nodes', async () => {
    const { container } = render(
      await RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          deviceSlug: 'apple-iphone-13-pro-max',
        }),
      })
    );

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((node) => JSON.parse(node.textContent ?? '{}'));
    const offerCatalog = schemas.find(
      (schema) => schema['@type'] === 'OfferCatalog'
    ) as
      | {
          '@id': string;
          itemListElement: Array<{
            '@type': string;
            serviceType: string;
            offers: Record<string, unknown>;
          }>;
        }
      | undefined;

    expect(offerCatalog?.['@id']).toBe(
      'https://ogabassey.com/repairs/apple-iphone-13-pro-max#repair-catalog'
    );
    expect(offerCatalog?.itemListElement[0]).toMatchObject({
      '@type': 'Service',
      serviceType: 'Screen Replacement',
      offers: {
        priceCurrency: 'NGN',
        priceSpecification: { minPrice: 25000 },
      },
    });
  });

  it('throws notFound when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    await expect(
      RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'missing',
          deviceSlug: 'apple-iphone-13-pro-max',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetRepairDeviceDetailBySlug).not.toHaveBeenCalled();
  });

  it('throws notFound when the repairs catalogue flag is off', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...enabledMerchant,
      feature_settings: { repairs_catalog_enabled: false },
    });

    await expect(
      RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          deviceSlug: 'apple-iphone-13-pro-max',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetRepairDeviceDetailBySlug).not.toHaveBeenCalled();
  });

  it('throws notFound when the device is unknown or inactive', async () => {
    mockGetRepairDeviceDetailBySlug.mockResolvedValueOnce(null);

    await expect(
      RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          deviceSlug: 'unknown-device',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('throws notFound for a malformed device slug before querying the catalogue', async () => {
    await expect(
      RepairDeviceDetailPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          deviceSlug: '../../etc/passwd',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetRepairDeviceDetailBySlug).not.toHaveBeenCalled();
  });

  it('builds metadata mentioning the device and its top repair services', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        deviceSlug: 'apple-iphone-13-pro-max',
      }),
    });

    expect(metadata.title).toMatchObject({
      absolute: expect.stringContaining('iPhone 13 Pro Max'),
    });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/repairs/apple-iphone-13-pro-max'
    );
  });

  it('returns not-found metadata when the device does not resolve', async () => {
    mockGetRepairDeviceDetailBySlug.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        deviceSlug: 'unknown-device',
      }),
    });

    expect(metadata.title).toBe('Repair Service Not Found');
  });
});
