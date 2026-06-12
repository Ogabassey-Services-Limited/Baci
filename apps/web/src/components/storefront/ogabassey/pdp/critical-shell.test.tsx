import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpCriticalShell } from './critical-shell';
import type { OgabasseyPdpCriticalProduct } from './critical-product';

vi.mock('next/image', () => ({
  getImageProps: ({
    alt,
    className,
    decoding,
    fetchPriority,
    fill,
    loader,
    loading,
    priority,
    quality,
    sizes,
    src,
  }: {
    alt: string;
    className?: string;
    decoding?: string;
    fetchPriority?: string;
    fill?: boolean;
    loader?: () => string;
    loading?: string;
    priority?: boolean;
    quality?: number;
    sizes?: string;
    src: string;
  }) => ({
    props: {
      alt,
      className,
      decoding,
      fetchPriority,
      fill,
      loader,
      loading,
      priority,
      quality,
      sizes,
      src,
      srcSet: `${src} 640w`,
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} href={href}>
      {children}
    </a>
  ),
}));


const defaultProduct: OgabasseyPdpCriticalProduct = {
  brand: 'Samsung',
  categoryName: 'Smartphones',
  categorySlug: 'smartphones',
  condition: 'new',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/galaxy-trifold.avif',
  name: 'Samsung Galaxy Z TriFold',
  price: 5_800_000,
  rating: 0,
  ratingCount: 0,
  reviewCount: 0,
  slug: 'samsung-galaxy-z-trifold',
  stockQuantity: 3,
};

function renderCriticalShell(
  productOverrides: Partial<OgabasseyPdpCriticalProduct> = {},
  children?: ReactNode
) {
  return render(
    <OgabasseyPdpCriticalShell
      basePath=""
      product={{ ...defaultProduct, ...productOverrides }}
    >
      {children}
    </OgabasseyPdpCriticalShell>
  );
}

describe('OgabasseyPdpCriticalShell', () => {
  it('renders one server-owned product heading and high-priority image', () => {
    renderCriticalShell(
      {
        brand: 'Lenovo',
        categoryName: 'Laptops',
        categorySlug: 'laptops',
        condition: 'used',
        id: 'product-1',
        image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
        name: 'Lenovo Legion Pro 9',
        price: 5_985_000,
        rating: 4.5,
        reviewCount: 12,
        slug: 'lenovo-legion-pro-9',
      },
      <button type="button">Add to Cart</button>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Lenovo Legion Pro 9' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).toHaveAttribute('fetchpriority', 'high');
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).toHaveAttribute('loading', 'eager');
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).not.toHaveAttribute('loader');
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).not.toHaveAttribute('priority');
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).not.toHaveAttribute('quality');
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).not.toHaveAttribute('fill');
    const mobileSource = document.querySelector(
      'source[media="(max-width: 767px)"]'
    );
    expect(mobileSource).toHaveAttribute('sizes', 'calc(100vw - 32px)');
    expect(mobileSource?.getAttribute('srcset')).toContain('750w');
    expect(mobileSource?.getAttribute('srcset')).not.toContain('1080w');
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/laptops'
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
  });

  it('does not render filled stars for products without reviews', () => {
    renderCriticalShell();

    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 5 stars/i)).not.toBeInTheDocument();
    expect(screen.queryByText('★★★★★')).not.toBeInTheDocument();
  });

  it('renders an honest rating signal for products with reviews', () => {
    renderCriticalShell({ rating: 4.5, reviewCount: 25 });

    expect(
      screen.getByRole('img', { name: '4.5 out of 5 stars' })
    ).toBeInTheDocument();
    expect(screen.getByText('4.5 ★')).toBeInTheDocument();
    expect(screen.getByText('25 Reviews')).toBeInTheDocument();
    expect(screen.queryByText('★★★★★')).not.toBeInTheDocument();
  });

  it('uses singular review copy for one review', () => {
    renderCriticalShell({ rating: 4, reviewCount: 1 });

    expect(screen.getByText('1 Review')).toBeInTheDocument();
  });

  it('renders rating-count-only aggregate ratings as ratings, not reviews', () => {
    renderCriticalShell({ rating: 4.5, ratingCount: 12, reviewCount: 0 });

    expect(
      screen.getByRole('img', { name: '4.5 out of 5 stars' })
    ).toBeInTheDocument();
    expect(screen.getByText('12 Ratings')).toBeInTheDocument();
    expect(screen.queryByText('No reviews yet')).not.toBeInTheDocument();
    expect(screen.queryByText('12 Reviews')).not.toBeInTheDocument();
  });

  it('displays review count when both reviews and ratings exist', () => {
    renderCriticalShell({ rating: 4.5, ratingCount: 12, reviewCount: 5 });

    expect(
      screen.getByRole('img', { name: '4.5 out of 5 stars' })
    ).toBeInTheDocument();
    expect(screen.getByText('5 Reviews')).toBeInTheDocument();
    expect(screen.queryByText('12 Ratings')).not.toBeInTheDocument();
  });

  it('shows review count without a rating signal when rating is zero', () => {
    renderCriticalShell({ rating: 0, reviewCount: 3 });

    expect(screen.getByText('3 Reviews')).toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 5 stars/i)).not.toBeInTheDocument();
  });

  it('clamps rendered rating values to the valid five-star range', () => {
    const { rerender } = renderCriticalShell({ rating: 5, reviewCount: 3 });

    expect(
      screen.getByRole('img', { name: '5 out of 5 stars' })
    ).toBeInTheDocument();

    rerender(
      <OgabasseyPdpCriticalShell
        basePath=""
        product={{ ...defaultProduct, rating: 5.8, reviewCount: 3 }}
      />
    );

    expect(
      screen.getByRole('img', { name: '5 out of 5 stars' })
    ).toBeInTheDocument();

    rerender(
      <OgabasseyPdpCriticalShell
        basePath=""
        product={{ ...defaultProduct, rating: -1, reviewCount: 3 }}
      />
    );

    expect(screen.queryByLabelText(/out of 5 stars/i)).not.toBeInTheDocument();
  });
});
