import { render, screen, within } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StorefrontLinkModulesSection } from './storefront-link-modules-section';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

describe('StorefrontLinkModulesSection', () => {
  it('renders maintained modules as crawlable internal links', () => {
    render(
      <StorefrontLinkModulesSection
        modules={[
          {
            id: 'catalog-pages',
            title: 'Browse product pages',
            description: 'Jump through the maintained product index.',
            items: [
              {
                href: '/products?page=6',
                label: 'Products page 6',
                source: 'catalog-pagination',
              },
            ],
          },
        ]}
        pathPrefix="/ogabassey"
      />
    );

    const section = screen.getByRole('region', {
      name: 'Explore Ogabassey buying paths',
    });

    expect(
      within(section).getByRole('link', { name: 'Products page 6' })
    ).toHaveAttribute('href', '/ogabassey/products?page=6');
  });

  it('renders nothing when every module is empty', () => {
    const { container } = render(
      <StorefrontLinkModulesSection
        modules={[
          {
            id: 'empty',
            title: 'Empty',
            description: 'No links',
            items: [],
          },
        ]}
        pathPrefix=""
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
