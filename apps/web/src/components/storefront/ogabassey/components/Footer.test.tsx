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
vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    mockBuildMerchantTrustProfile(...args),
}));
vi.mock('@/lib/social', () => ({
  normalizeSocialUrl: (value: string | undefined) => value,
}));

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
        merchant={{
          business_name: 'Ogabassey',
          social_media: {},
          email: 'support@ogabassey.com',
          phone: '+2348000000000',
          business_address: 'Lagos',
        }}
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
        merchant={{
          business_name: 'Ogabassey',
          social_media: {},
          email: 'support@ogabassey.com',
          phone: '+2348000000000',
          business_address: 'Lagos',
        }}
      />
    );

    expect(screen.queryByRole('link', { name: 'Returns' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Shipping' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Warranty' })).toBeNull();
  });

  it('omits Returns when only return method data exists', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        summary: '   ',
        localRoute: '/returns',
      },
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={{
          business_name: 'Ogabassey',
          social_media: {},
          email: 'support@ogabassey.com',
          phone: '+2348000000000',
          business_address: 'Lagos',
        }}
      />
    );

    expect(screen.queryByRole('link', { name: 'Returns' })).toBeNull();
  });

  it('omits Shipping when only handling details exist', () => {
    mockBuildMerchantTrustProfile.mockReturnValue({
      shippingPolicy: {
        summary: '   ',
        localRoute: '/shipping',
      },
      socialLinks: {},
      derivedLinks: {},
    });
    render(
      <Footer
        storeSlug="ogabassey"
        merchant={{
          business_name: 'Ogabassey',
          social_media: {},
          email: 'support@ogabassey.com',
          phone: '+2348000000000',
          business_address: 'Lagos',
        }}
      />
    );

    expect(screen.queryByRole('link', { name: 'Shipping' })).toBeNull();
  });
});
