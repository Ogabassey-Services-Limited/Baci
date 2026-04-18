import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryHubCardGrid } from './category-hub-card-grid';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('CategoryHubCardGrid', () => {
  it('renders crawlable card links and the optional compare CTA when both fields are present', () => {
    render(
      <CategoryHubCardGrid
        title="Best for"
        cards={[
          {
            title: 'Best for Photography',
            description: 'Strong camera options.',
            href: '/smartphones/apple-pro',
            eyebrow: 'Smartphones',
            secondaryHref: '/smartphones/compare/apple-pro-vs-samsung-ultra',
            secondaryLabel: 'Compare Apple Pro vs Samsung Ultra',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Best for' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Best for Photography' })
    ).toHaveAttribute('href', '/smartphones/apple-pro');
    expect(
      screen.getByRole('link', {
        name: 'Compare Apple Pro vs Samsung Ultra',
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/apple-pro-vs-samsung-ultra'
    );
  });

  it('omits the compare CTA when only one secondary field is provided', () => {
    render(
      <CategoryHubCardGrid
        title="Popular brands"
        cards={[
          {
            title: 'Samsung',
            description: 'A broad selection of Samsung phones.',
            href: '/smartphones/samsung-galaxy-s24',
            secondaryHref: '/smartphones/compare/samsung-vs-apple',
          },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Samsung' })).toHaveAttribute(
      'href',
      '/smartphones/samsung-galaxy-s24'
    );
    expect(
      screen.queryByRole('link', { name: /compare samsung/i })
    ).not.toBeInTheDocument();
  });
});
