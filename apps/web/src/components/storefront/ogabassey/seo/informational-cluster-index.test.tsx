import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InformationalClusterIndex } from './informational-cluster-index';

describe('InformationalClusterIndex', () => {
  it('renders guide collections and their guide links', () => {
    render(
      <InformationalClusterIndex
        collections={[
          {
            categorySlug: 'smartphones',
            heading: 'Smartphone buying guides',
            categoryHref: '/smartphones',
            guides: [
              {
                href: '/blog/best-phones-in-nigeria',
                title: 'Best Phones in Nigeria',
                description: 'Budget and flagship picks.',
                kind: 'best-in-nigeria',
              },
            ],
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /guide collections/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Smartphone buying guides' })
    ).toHaveAttribute('href', '/smartphones');
    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' })
    ).toHaveAttribute('href', '/blog/best-phones-in-nigeria');
  });

  it('renders nothing when there are no collections', () => {
    const { container } = render(
      <InformationalClusterIndex collections={[]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
