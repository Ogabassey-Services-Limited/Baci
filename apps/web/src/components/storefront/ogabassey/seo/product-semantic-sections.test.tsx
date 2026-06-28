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
  it('renders buyer guides, card sections, and support links (no trust bullets)', () => {
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

    // The "Buying context" trust-bullet section was removed from the PDP, so
    // trust bullets in the model must NOT render.
    expect(
      screen.queryByRole('heading', { name: 'Buying context' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Free returns within 7 days')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Ships across Nigeria')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Buyer guides' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Compare and Buying Guides' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Shop more Smartphones' })
    ).toHaveAttribute('href', '/smartphones');
    expect(
      screen.getByText('Alternative phones to compare')
    ).toBeInTheDocument();
    expect(screen.getByText('More phones from this brand')).toBeInTheDocument();
    expect(
      screen.getByText('More phones in this price range')
    ).toBeInTheDocument();
    const guideHeading = screen.getByRole('heading', { name: 'Buyer guides' });
    const alternativeHeading = screen.getByRole('heading', {
      name: 'Alternative phones to compare',
    });

    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' }),
    ).toHaveAttribute('href', '/blog/best-phones-in-nigeria');
    expect(
      guideHeading.compareDocumentPosition(alternativeHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

  it('renders the curated support links section when only support links exist', () => {
    render(
      <ProductSemanticSections
        model={{
          trustBullets: [],
          supportLinks: [
            { href: '/smartphones', label: 'Shop more Smartphones' },
          ],
          guideLinks: [],
          alternatives: null,
          sameBrand: null,
          samePrice: null,
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Compare and Buying Guides' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Shop more Smartphones' })
    ).toHaveAttribute('href', '/smartphones');
  });
});
