import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareRelatedLinks } from './compare-related-links';

const mockHeaders = vi.fn<() => Promise<Headers>>();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

const links = [
  {
    href: '/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max',
    label: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
    description:
      'Compare price, specs, condition, and buying fit for iPhone 17 Pro Max and Galaxy S24 FE.',
    categorySlug: 'smartphones',
    comparisonSlug: 'galaxy-s24-fe-vs-iphone-17-pro-max',
    productSlugs: ['iphone-17-pro-max', 'galaxy-s24-fe'] as [string, string],
    productNames: ['iPhone 17 Pro Max', 'Galaxy S24 FE'] as [string, string],
    anchorProductSlug: 'iphone-17-pro-max',
    score: 32,
  },
];

describe('CompareRelatedLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes related links for platform path-mode compare pages', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers());

    render(
      await CompareRelatedLinks({
        links,
        merchantCustomDomain: 'ogabassey.com',
        merchantSlug: 'ogabassey',
        storeUrl: 'https://ogabassey.com',
      })
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
      })
    ).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max'
    );
  });

  it('keeps related links root-relative for custom-domain compare pages', async () => {
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    render(
      await CompareRelatedLinks({
        links,
        merchantCustomDomain: 'ogabassey.com',
        merchantSlug: 'ogabassey',
        storeUrl: 'https://ogabassey.com',
      })
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max'
    );
  });

  it('keeps related links prefixed when custom-domain headers do not match the merchant', async () => {
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-custom-domain', 'evil.example']])
    );

    render(
      await CompareRelatedLinks({
        links,
        merchantCustomDomain: 'ogabassey.com',
        merchantSlug: 'ogabassey',
        storeUrl: 'https://ogabassey.com',
      })
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
      })
    ).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max'
    );
  });
});
