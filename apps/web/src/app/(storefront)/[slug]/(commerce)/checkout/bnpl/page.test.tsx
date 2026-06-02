import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';
import BnplCheckoutPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(async () => ({ id: 'merchant-1' })),
  getCachedMerchantByDomain: vi.fn(async () => ({ id: 'merchant-1' })),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: vi.fn(() => false),
}));

vi.mock('@/components/storefront/ogabassey/pages/bnpl-launcher', () => ({
  BnplLauncher: () => {
    throw new Promise(() => undefined);
  },
}));

describe('BNPL checkout page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a static checkout fallback while the search-param launcher suspends', async () => {
    const element = await BnplCheckoutPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    render(element);

    expect(
      screen.getByRole('heading', { name: /secure checkout/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/launching payment gateway/i)).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /loading bnpl checkout/i })
    ).toBeVisible();
  });

  it('calls notFound when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    await expect(
      BnplCheckoutPage({
        params: Promise.resolve({ slug: 'missing-store' }),
      })
    ).rejects.toThrow('not found');

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('uses domain merchant lookup for domain-like storefront identifiers', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValueOnce(true);

    const element = await BnplCheckoutPage({
      params: Promise.resolve({ slug: 'example.com' }),
    });

    render(element);

    expect(isDomainIdentifier).toHaveBeenCalledWith('example.com');
    expect(getCachedMerchantByDomain).toHaveBeenCalledWith('example.com');
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: /secure checkout/i })
    ).toBeInTheDocument();
  });

  it('calls notFound when a domain-like storefront identifier is unmapped', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValueOnce(true);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValueOnce(null);

    await expect(
      BnplCheckoutPage({
        params: Promise.resolve({ slug: 'missing.example.com' }),
      })
    ).rejects.toThrow('not found');

    expect(isDomainIdentifier).toHaveBeenCalledWith('missing.example.com');
    expect(getCachedMerchantByDomain).toHaveBeenCalledWith(
      'missing.example.com'
    );
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
