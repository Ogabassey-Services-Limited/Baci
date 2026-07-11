import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompareRelatedLinks } from './compare-related-links';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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
  it('uses canonical custom-domain URLs without reading request headers', () => {
    render(
      <CompareRelatedLinks links={links} storeUrl="https://ogabassey.com" />
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
      })
    ).toHaveAttribute(
      'href',
      'https://ogabassey.com/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max'
    );
  });

  it('preserves the merchant path prefix in canonical platform URLs', () => {
    render(
      <CompareRelatedLinks
        links={links}
        storeUrl="https://usebaci.com/ogabassey"
      />
    );

    expect(
      screen.getByRole('link', {
        name: 'Compare iPhone 17 Pro Max with Galaxy S24 FE',
      })
    ).toHaveAttribute(
      'href',
      'https://usebaci.com/ogabassey/smartphones/compare/galaxy-s24-fe-vs-iphone-17-pro-max'
    );
  });

  it('renders nothing when there are no related comparisons', () => {
    const { container } = render(
      <CompareRelatedLinks links={[]} storeUrl="https://ogabassey.com" />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
