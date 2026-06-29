import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedMerchant } from '@/lib/cached-data';

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
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    render(
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
  });

  it('returns repair metadata with a useful service description', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      business_name: 'Ogabassey',
      slug: 'ogabassey',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

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
});
