import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductSemanticSections } from './product-semantic-sections';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ProductSemanticSections', () => {
  it('renders trust bullets, card sections, and support links', () => {
    render(
      <ProductSemanticSections
        model={{
          trustBullets: [
            'Free returns within 7 days',
            'Ships across Nigeria',
            'WhatsApp support available',
          ],
          supportLinks: [
            { href: '/smartphones', label: 'Shop more Smartphones' },
          ],
          guideLinks: [
            {
              href: '/blog/best-phones-in-nigeria',
              title: 'Best Phones in Nigeria',
              description: 'Budget and flagship picks.',
              kind: 'best-in-nigeria',
            },
          ],
          alternatives: {
            heading: 'Alternative phones to compare',
            cards: [
              {
                title: 'iPhone 17 Air',
                description: 'Closer in price',
                href: '/smartphones/iphone-17-air',
              },
            ],
          },
          sameBrand: {
            heading: 'More phones from this brand',
            cards: [
              {
                title: 'Galaxy S24',
                description: 'Samsung alternative',
                href: '/smartphones/galaxy-s24',
              },
            ],
          },
          samePrice: {
            heading: 'More phones in this price range',
            cards: [
              {
                title: 'Pixel 10',
                description: 'Similar price',
                href: '/smartphones/pixel-10',
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('Free returns within 7 days')).toBeInTheDocument();
    expect(screen.getByText('Ships across Nigeria')).toBeInTheDocument();
    expect(
      screen.getByText('WhatsApp support available')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Shop more Smartphones' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Alternative phones to compare'),
    ).toBeInTheDocument();
    expect(screen.getByText('More phones from this brand')).toBeInTheDocument();
    expect(
      screen.getByText('More phones in this price range'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' }),
    ).toHaveAttribute('href', '/blog/best-phones-in-nigeria');
  });

  it('omits empty wrappers when every section is empty', () => {
    const { container } = render(
      <ProductSemanticSections
        model={{
          trustBullets: [],
          supportLinks: [],
          guideLinks: [],
          alternatives: null,
          sameBrand: null,
          samePrice: null,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
