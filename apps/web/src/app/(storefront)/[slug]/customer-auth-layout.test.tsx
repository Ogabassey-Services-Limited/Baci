import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  CustomerAuthProvider: vi.fn(
    ({
      children,
      merchantSlug,
    }: {
      children: ReactNode;
      merchantSlug: string;
    }) => (
      <div data-testid="customer-auth" data-merchant-slug={merchantSlug}>
        {children}
      </div>
    )
  ),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: vi.fn(() => false),
}));

import { notFound } from 'next/navigation';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';
import CustomerAuthLayout from './customer-auth-layout';

function createMerchant(slug: string): CachedMerchant {
  return {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    site_title: 'Ogabassey',
    site_tagline: 'Premium fashion',
    site_description: 'Description',
    business_type: 'fashion',
    logo_url: '',
    phone: '+2348000000000',
    email: 'hello@ogabassey.com',
    slug,
    business_address: 'Lagos, Nigeria',
    payout_currency: 'NGN',
    is_published: true,
    template_id: 'ogabassey',
    plan_tier: 'growth',
    premium_features: {},
  };
}

describe('CustomerAuthLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDomainIdentifier).mockReturnValue(false);
  });

  it('wraps children with the resolved merchant slug', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue(createMerchant('ogabassey'));

    const node = await CustomerAuthLayout({
      children: <div>Child content</div>,
      params: { slug: 'ogabassey' },
    });

    render(node);

    expect(screen.getByText('Child content')).toBeInTheDocument();
    expect(screen.getByTestId('customer-auth')).toHaveAttribute(
      'data-merchant-slug',
      'ogabassey'
    );
  });

  it('resolves merchants by domain identifier when needed', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValue(true);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(
      createMerchant('ogabassey')
    );

    const node = await CustomerAuthLayout({
      children: <div>Domain child</div>,
      params: { slug: 'shop.ogabassey.com' },
    });

    render(node);

    expect(getCachedMerchantByDomain).toHaveBeenCalledWith(
      'shop.ogabassey.com'
    );
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(screen.getByText('Domain child')).toBeInTheDocument();
    expect(screen.getByTestId('customer-auth')).toHaveAttribute(
      'data-merchant-slug',
      'ogabassey'
    );
  });

  it('calls notFound when the merchant cannot be resolved', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue(null);

    await expect(
      CustomerAuthLayout({
        children: <div>Missing merchant</div>,
        params: { slug: 'missing-store' },
      })
    ).rejects.toThrow('notFound');

    expect(notFound).toHaveBeenCalledOnce();
  });

  it('calls notFound when domain-based merchant resolution fails', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValue(true);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValue(null);

    await expect(
      CustomerAuthLayout({
        children: <div>Missing domain merchant</div>,
        params: { slug: 'unknown.ogabassey.com' },
      })
    ).rejects.toThrow('notFound');

    expect(notFound).toHaveBeenCalledOnce();
    expect(getCachedMerchant).not.toHaveBeenCalled();
  });
});
