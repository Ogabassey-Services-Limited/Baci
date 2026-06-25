import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InternalLinkEquitySection } from './internal-link-equity-section';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

describe('InternalLinkEquitySection', () => {
  it('renders crawlable links with storefront path prefixes', () => {
    render(
      <InternalLinkEquitySection
        groups={[
          {
            title: 'Smartphones',
            description: 'Popular phone paths.',
            links: [
              { href: '/', label: 'Home' },
              { href: '/smartphones/iphone-xr-3gb-128gb', label: 'iPhone XR' },
            ],
          },
        ]}
        pathPrefix="/ogabassey"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Explore more buying paths' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/ogabassey'
    );
    expect(screen.getByRole('link', { name: 'iPhone XR' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/iphone-xr-3gb-128gb'
    );
  });

  it('renders nothing without visible link groups', () => {
    const { container } = render(
      <InternalLinkEquitySection groups={[]} pathPrefix="" />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
