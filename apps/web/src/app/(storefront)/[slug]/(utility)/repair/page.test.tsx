import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isValidMerchantIdentifier } from '@/lib/validation';

vi.mock('@/components/storefront/RepairBookingWizard', () => ({
  RepairBookingWizard: ({
    merchantId,
    merchantName,
  }: {
    merchantId: string;
    merchantName: string;
  }) => (
    <div data-merchant-id={merchantId} data-merchant-name={merchantName}>
      Repair booking wizard
    </div>
  ),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(async () => null),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: vi.fn(() => false),
  isValidMerchantIdentifier: vi.fn(() => true),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

const { default: RepairPage, generateMetadata } = await import('./page');

describe('RepairPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    notFound.mockClear();
  });

  it('renders crawler-visible repair guidance before the booking wizard', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      template_id: 'ogabassey',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    const { container } = render(
      await RepairPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Before you book a repair' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/describe the device model, visible damage/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Repair booking wizard')).toHaveAttribute(
      'data-merchant-id',
      'merchant-1'
    );

    const jsonLd = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')
        ?.textContent ?? '{}'
    ) as { '@type': string; itemListElement: Array<{ name: string }> };

    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement.map((item) => item.name)).toEqual([
      'Ogabassey',
      'Book a Repair',
    ]);
  });

  it('returns repair metadata with an absolute title and a useful service description', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      business_name: 'Ogabassey',
      slug: 'ogabassey',
      template_id: 'ogabassey',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    // Absolute so the platform `%s | Baci` template never applies, and
    // distinct from the /repairs landing-page title.
    expect(metadata.title).toEqual({ absolute: 'Book a Repair - Ogabassey' });
    expect(metadata.description).toContain('phone, laptop, console');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.usebaci.com/repair'
    );
  });

  it('throws notFound when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue(null);

    await expect(
      RepairPage({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('throws notFound for merchants that are not on the Ogabassey template', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      id: 'merchant-2',
      business_name: 'Other Store',
      template_id: 'default',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    await expect(
      RepairPage({ params: Promise.resolve({ slug: 'other-store' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns not-found metadata for merchants that are not on the Ogabassey template', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      business_name: 'Other Store',
      slug: 'other-store',
      template_id: 'default',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'other-store' }),
    });

    expect(metadata.title).toBe('Store Not Found');
  });

  it('rejects invalid slugs before reaching the cached merchant lookups', async () => {
    vi.mocked(isValidMerchantIdentifier).mockReturnValueOnce(false);

    await expect(
      RepairPage({
        params: Promise.resolve({ slug: '%2525'.repeat(500) }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    // The unbounded `'use cache'` keys must never see a bot-supplied slug.
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(getCachedMerchantByDomain).not.toHaveBeenCalled();
  });

  it('returns not-found metadata for invalid slugs without a cached lookup', async () => {
    vi.mocked(isValidMerchantIdentifier).mockReturnValueOnce(false);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: '../../etc/passwd' }),
    });

    expect(metadata.title).toBe('Store Not Found');
    expect(getCachedMerchant).not.toHaveBeenCalled();
  });
});
