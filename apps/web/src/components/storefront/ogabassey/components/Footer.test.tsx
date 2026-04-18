import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from './Footer';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('./Logo', () => ({
  Logo: () => <span>Logo</span>,
}));
const mockBuildMerchantTrustProfile = vi.fn();
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
vi.mock('@/lib/social', () => ({
  normalizeSocialUrl: (value: string | undefined) => value,
}));

const merchantFixture = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  social_media: {},
  email: 'support@ogabassey.com',
  phone: '+2348000000000',
  business_address: 'Lagos',
};

describe('Ogabassey Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds trust policy links to the support section when available', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        summary: 'Returns',
        windowDays: 7,
        localRoute: '/returns',
      },
      shippingPolicy: {
        summary: 'Shipping',
        regions: ['Nigeria'],
        localRoute: '/shipping',
      },
      warrantyPolicy: {
        summary: 'Warranty',
        localRoute: '/warranty',
      },
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={merchantFixture}
      />
    );

    expect(screen.getByRole('link', { name: 'Returns' })).toHaveAttribute(
      'href',
      '/ogabassey/returns'
    );
    expect(screen.getByRole('link', { name: 'Shipping' })).toHaveAttribute(
      'href',
      '/ogabassey/shipping'
    );
    expect(screen.getByRole('link', { name: 'Warranty' })).toHaveAttribute(
      'href',
      '/ogabassey/warranty'
    );
  });

  it('omits trust policy links when merchant trust data is missing', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={merchantFixture}
      />
    );

    expect(screen.queryByRole('link', { name: 'Returns' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Shipping' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Warranty' })).toBeNull();
  });

  it('renders Returns when only return method data exists', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        returnMethod: 'mail',
        returnFees: 'free',
        localRoute: '/returns',
      },
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={merchantFixture}
      />
    );

    expect(screen.getByRole('link', { name: 'Returns' })).toHaveAttribute(
      'href',
      '/ogabassey/returns'
    );
  });

  it('renders Shipping when only handling details exist', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      shippingPolicy: {
        handlingDaysMin: 0,
        shippingFeeType: 'calculated',
        localRoute: '/shipping',
      },
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={merchantFixture}
      />
    );

    expect(screen.getByRole('link', { name: 'Shipping' })).toHaveAttribute(
      'href',
      '/ogabassey/shipping'
    );
  });
});
