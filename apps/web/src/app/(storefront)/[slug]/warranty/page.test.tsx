import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

const mockHeaders = vi.fn();
const mockBuildMerchantTrustProfile = vi.fn();
const mockBuildRequestScopedStoreUrl = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock(
  '@/lib/storefront-trust/build-merchant-trust-profile',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/storefront-trust/build-merchant-trust-profile')
      >();

    return {
      ...actual,
      buildMerchantTrustProfile: (...args: unknown[]) =>
        mockBuildMerchantTrustProfile(...args),
    };
  }
);

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: (...args: unknown[]) =>
    mockBuildRequestScopedStoreUrl(...args),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

const trustMerchant = {
  business_name: 'Ogabassey',
  slug: 'ogabassey',
  trust_profile: {
    warranty_policy: {
      summary: 'Manufacturer warranty applies.',
    },
  },
  updated_at: '2026-01-01T00:00:00.000Z',
  logo_url: null,
} as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>;

describe('warranty page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockBuildRequestScopedStoreUrl.mockReturnValue('https://ogabassey.com');
    mockBuildMerchantTrustProfile.mockReturnValue({
      warrantyPolicy: {
        summary: 'Manufacturer warranty applies.',
        localRoute: '/warranty',
      },
      socialLinks: {},
      derivedLinks: { contact: 'https://ogabassey.com/contact' },
    });
  });

  it('returns canonical metadata for a merchant with warranty coverage', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(trustMerchant);
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/warranty'
    );
  });

  it('renders when the warranty summary exists', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(trustMerchant);
    const { default: WarrantyPage } = await import('./page');

    render(
      await WarrantyPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(mockBuildMerchantTrustProfile).toHaveBeenCalledWith(
      trustMerchant,
      'https://ogabassey.com'
    );
    expect(
      screen.getByRole('heading', { name: 'Warranty Policy' })
    ).toBeInTheDocument();
  });

  it('notFound when no warranty summary is present', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...trustMerchant,
      trust_profile: {
        warranty_policy: {},
      },
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);
    mockBuildMerchantTrustProfile.mockReturnValue({
      socialLinks: {},
      derivedLinks: {},
    });
    const { default: WarrantyPage } = await import('./page');

    await expect(
      WarrantyPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
