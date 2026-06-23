import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

const { mockHeaders, mockOgabasseyV2Repairs } = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
  mockOgabasseyV2Repairs: vi.fn(),
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
  OgabasseyV2Repairs: (props: { basePath?: string }) => {
    mockOgabasseyV2Repairs(props);
    return (
      <section aria-label="Repairs page">basePath:{props.basePath}</section>
    );
  },
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
  custom_domain: 'ogabassey.com',
  slug: 'ogabassey',
  template_id: 'ogabassey',
} as unknown as NonNullable<Awaited<ReturnType<typeof getCachedMerchant>>>;

const { default: RepairsPage, generateMetadata } = await import('./page');

describe('RepairsPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockOgabasseyV2Repairs.mockClear();
    vi.mocked(getCachedMerchant).mockResolvedValue(merchant);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(merchant);
  });

  it('uses root-relative links when the proxy resolved the merchant slug', async () => {
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
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({ basePath: '' });
  });

  it('uses root-relative links when the proxy resolved the custom domain', async () => {
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
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({ basePath: '' });
  });

  it('keeps path-based routes under the merchant slug without trusted proxy headers', async () => {
    render(
      await RepairsPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(
      screen.getByRole('region', { name: /repairs page/i })
    ).toHaveTextContent('basePath:/ogabassey');
    expect(mockOgabasseyV2Repairs).toHaveBeenCalledWith({
      basePath: '/ogabassey',
    });
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

  it('throws notFound for non-Ogabassey merchants', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce({
      ...merchant,
      template_id: 'default',
    });

    await expect(
      RepairsPage({
        params: Promise.resolve({ slug: 'other-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
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

  it('returns fallback metadata for non-Ogabassey merchants', async () => {
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

  it('generates merchant-branded metadata', async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    ).resolves.toEqual({
      title: 'Book a Repair - Ogabassey',
      description: 'Schedule a device repair with Ogabassey',
    });
  });
});
