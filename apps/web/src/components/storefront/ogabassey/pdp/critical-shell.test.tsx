import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpCriticalShell } from './critical-shell';
import type { OgabasseyPdpCriticalProduct } from './critical-product';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    fill,
    loader,
    loading,
    preload,
    quality,
    sizes,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    fill?: boolean;
    loader?: (params: {
      quality?: number;
      src: string;
      width: number;
    }) => string;
    loading?: string;
    preload?: boolean;
    quality?: number;
    sizes?: string;
    src: string;
  }) => {
    const resolvedSrc = loader
      ? loader({ quality, src, width: 3840 })
      : src;
    const srcSet = loader
      ? [640, 750]
          .map((width) => `${loader({ quality, src, width })} ${width}w`)
          .join(', ')
      : `${src} 640w`;

    return (
      // biome-ignore lint/performance/noImgElement: next/image test double exposes rendered attributes
      <img
        alt={alt}
        data-fetch-priority={fetchPriority}
        data-fill={String(Boolean(fill))}
        data-loading={loading}
        data-preload={String(Boolean(preload))}
        sizes={sizes}
        src={resolvedSrc}
        srcSet={srcSet}
      />
    );
  },
  getImageProps: vi.fn(),
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
  imageVersion: 'lcpv1',
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
    const productImage = screen.getByRole('img', {
      name: 'Lenovo Legion Pro 9',
    });

    expect(productImage).toHaveAttribute('data-fetch-priority', 'high');
    expect(productImage).toHaveAttribute('data-loading', 'eager');
    expect(productImage).toHaveAttribute('data-preload', 'false');
    expect(productImage).toHaveAttribute('data-fill', 'true');
    expect(productImage).not.toHaveAttribute('loader');
    expect(productImage).not.toHaveAttribute('priority');
    expect(productImage).not.toHaveAttribute('quality');
    expect(productImage).not.toHaveAttribute('fill');
    expect(document.querySelector('source')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).toHaveAttribute(
      'sizes',
      '(max-width: 767.98px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), (max-width: 1439px) 40vw, 560px'
    );
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

  it('can render same-origin PDP image URLs for known OgaBassey routes', () => {
    render(
      <OgabasseyPdpCriticalShell
        basePath=""
        imageDelivery="same-origin"
        product={{
          ...defaultProduct,
          image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
          imageVersion: 'lcpv2',
          name: 'Lenovo Legion Pro 9',
          slug: 'lenovo-legion-pro-9',
        }}
      />
    );

    const sameOriginProductImage = screen.getByRole('img', {
      name: 'Lenovo Legion Pro 9',
    });

    expect(sameOriginProductImage).toHaveAttribute(
      'src',
      '/api/ogabassey/pdp-lcp-image/profile/desktop/lenovo-legion-pro-9?v=lcpv2'
    );
    expect(sameOriginProductImage).toHaveAttribute(
      'data-fetch-priority',
      'high'
    );
    expect(sameOriginProductImage).toHaveAttribute('data-loading', 'eager');
    expect(sameOriginProductImage).toHaveAttribute('data-preload', 'false');
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
