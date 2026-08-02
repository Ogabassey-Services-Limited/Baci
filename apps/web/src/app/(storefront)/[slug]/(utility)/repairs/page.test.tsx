import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

const {
  mockHeaders,
  mockOgabasseyV2Repairs,
  mockGenericRepairsPage,
  mockGetRepairDevicesForMerchant,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
  mockOgabasseyV2Repairs: vi.fn(),
  mockGenericRepairsPage: vi.fn(),
  mockGetRepairDevicesForMerchant: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/components/storefront/ogabassey/pages/repairs', () => ({
  OgabasseyV2Repairs: (props: { basePath?: string; groups?: unknown }) => {
    mockOgabasseyV2Repairs(props);
    return (
      <section aria-label="Repairs page">basePath:{props.basePath}</section>
    );
  },
}));

vi.mock('@/components/storefront/repairs/GenericRepairsPage', () => ({
  GenericRepairsPage: (props: Record<string, unknown>) => {
    mockGenericRepairsPage(props);
    return <section aria-label="Generic repairs page" />;
  },
}));

vi.mock('@/lib/repairs/repairs-catalog-data', () => ({
  getRepairDevicesForMerchant: (...args: unknown[]) =>
    mockGetRepairDevicesForMerchant(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: (value: string) => value.length > 0,
}));

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  custom_domain: 'ogabassey.com',
  slug: 'ogabassey',
  template_id: 'ogabassey',
  feature_settings: { repairs_catalog_enabled: false },
} as unknown as NonNullable<Awaited<ReturnType<typeof getCachedMerchant>>>;

const { default: RepairsPage, generateMetadata } = await import('./page');

describe('RepairsPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockOgabasseyV2Repairs.mockClear();
    mockGenericRepairsPage.mockClear();
    mockGetRepairDevicesForMerchant.mockReset();
    mockGetRepairDevicesForMerchant.mockResolvedValue([]);
    vi.mocked(getCachedMerchant).mockResolvedValue(merchant);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(merchant);
  });

  it('uses root-relative links when the proxy resolved the merchant slug', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      ...merchant,
      feature_settings: { repairs_catalog_enabled: true },
    });
    mockHeaders.mockResolvedValue(
      new Headers([['x-merchant-slug', 'Ogabassey']])
    );

    render(
      await RepairsPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(
      screen.getByRole('region', { name: /repairs page/i })
    ).toHaveTextContent('basePath:');
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({
      basePath: '',
      groups: [],
    });
  });

  it('uses root-relative links when the proxy resolved the custom domain', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      ...merchant,
      feature_settings: { repairs_catalog_enabled: true },
    });
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    render(
      await RepairsPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(
      screen.getByRole('region', { name: /repairs page/i })
    ).toHaveTextContent('basePath:');
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({
      basePath: '',
      groups: [],
    });
  });

  it('keeps path-based routes under the merchant slug without trusted proxy headers', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      ...merchant,
      feature_settings: { repairs_catalog_enabled: true },
    });
    const { container } = render(
      await RepairsPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(
      screen.getByRole('region', { name: /repairs page/i })
    ).toHaveTextContent('basePath:/ogabassey');
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({
      basePath: '/ogabassey',
      groups: [],
    });

    const jsonLd = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')
        ?.textContent ?? '{}'
    ) as { '@type': string; itemListElement: Array<{ name: string }> };

    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement.map((item) => item.name)).toEqual([
      'Ogabassey',
      'Repairs',
    ]);
  });

  it('emits an additive ItemList JSON-LD of device repair pages when the catalogue is enabled', async () => {
    const enabledMerchant = {
      ...merchant,
      template_id: 'generic',
      feature_settings: { repairs_catalog_enabled: true },
    } as typeof merchant;
    vi.mocked(getCachedMerchant).mockResolvedValue(enabledMerchant);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(enabledMerchant);
    mockGetRepairDevicesForMerchant.mockResolvedValue([
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
    ]);

    const { container } = render(
      await RepairsPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((node) => JSON.parse(node.textContent ?? '{}'));
    const itemList = schemas.find((schema) => schema['@type'] === 'ItemList') as
      | { itemListElement: Array<{ item: string; name: string }> }
      | undefined;

    expect(itemList).toBeDefined();
    expect(itemList?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Apple iPhone 13',
        item: 'https://ogabassey.com/repairs/apple-iphone-13',
      },
    ]);
  });

  it('throws notFound when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    await expect(
      RepairsPage({
        params: Promise.resolve({ slug: 'missing-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockOgabasseyV2Repairs).not.toHaveBeenCalled();
  });

  it('throws notFound for every merchant when the catalogue flag is off', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      template_id: 'ogabassey',
    });

    await expect(
      RepairsPage({
        params: Promise.resolve({ slug: 'other-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockOgabasseyV2Repairs).not.toHaveBeenCalled();
    expect(mockGenericRepairsPage).not.toHaveBeenCalled();
  });

  it('renders the catalogue-driven Ogabassey skin with fetched device groups when the flag is on', async () => {
    const groups = [{ brand: 'Apple', devices: [] }];
    mockGetRepairDevicesForMerchant.mockResolvedValueOnce(groups);
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      feature_settings: { repairs_catalog_enabled: true },
    });

    render(
      await RepairsPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(mockGetRepairDevicesForMerchant).toHaveBeenCalledWith('merchant-1');
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({
      basePath: '/ogabassey',
      groups,
    });
  });

  it('renders the generic themed repairs page for non-Ogabassey merchants when the catalogue flag is on', async () => {
    const groups = [{ brand: 'Samsung', devices: [] }];
    mockGetRepairDevicesForMerchant.mockResolvedValueOnce(groups);
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      template_id: 'default',
      business_name: 'Acme Gadgets',
      feature_settings: { repairs_catalog_enabled: true },
    });

    render(
      await RepairsPage({ params: Promise.resolve({ slug: 'other-store' }) })
    );

    expect(mockGenericRepairsPage).toHaveBeenCalledWith({
      basePath: '/ogabassey',
      groups,
      merchantName: 'Acme Gadgets',
    });
    expect(mockOgabasseyV2Repairs).not.toHaveBeenCalled();
  });

  it('returns fallback metadata when merchant resolution misses', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'missing-store' }),
      })
    ).resolves.toEqual({ title: 'Repair Service Not Found' });
  });

  it('returns fallback metadata for non-Ogabassey merchants with the flag off', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      template_id: 'default',
    });

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'other-store' }),
      })
    ).resolves.toEqual({ title: 'Repair Service Not Found' });
  });

  it('generates real metadata for non-Ogabassey merchants with the flag on', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      template_id: 'default',
      business_name: 'Acme Gadgets',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'other-store' }),
    });

    expect(metadata.title).toEqual({
      absolute: 'Device Repairs - Acme Gadgets',
    });
  });

  it('generates merchant-branded metadata distinct from the /repair booking page', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      feature_settings: { repairs_catalog_enabled: true },
    });

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    ).resolves.toEqual({
      // Absolute so the platform `%s | Baci` template never applies, and
      // distinct from the /repair booking-wizard title.
      title: { absolute: 'Device Repairs - Ogabassey' },
      description:
        'Explore phone, laptop, and gadget repair services from Ogabassey with expert technicians and genuine parts.',
      alternates: {
        canonical: 'https://ogabassey.com/repairs',
      },
    });
  });
});
