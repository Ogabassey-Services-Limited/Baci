import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { ProductListItem } from './ProductListItem';

vi.mock('next/link', () => ({
  default: (
    props: { children: React.ReactNode; href: string } & Record<string, unknown>
  ) => {
    const { children, href, prefetch: _prefetch, ...anchorProps } = props;

    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    );
  },
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, fill: _fill, priority: _priority, ...imageProps } = props;

    return <img {...imageProps} alt={String(alt ?? '')} />;
  },
}));

// List images now render through CdnFormatImage (explicit per-format <picture>).
// Its real pipeline calls next/image's `getImageProps`; surface it as a plain
// <img> so these tests keep asserting list behavior (alt text, color swap, the
// warm-cache mount reveal), not image internals.
vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { alt, fill: _fill, preload: _preload, ...imageProps } = props;

    return <img {...imageProps} alt={String(alt ?? '')} />;
  },
}));

const baseProduct: Product = {
  id: 'product-1',
  name: 'MacBook Pro',
  price: '₦3,450,000',
  image: '/macbook.jpg',
  category: 'Laptops',
  slug: 'macbook-pro',
  categories: {
    id: 'cat-laptops',
    name: 'Laptops',
    slug: 'laptops',
  },
  rating: 4.7,
  description: 'Powerful laptop for creative work.',
  condition: 'New',
  images: ['/macbook-silver.jpg', '/macbook-space-black.jpg'],
  colors: [
    { name: 'Silver', value: '#d1d5db' },
    { name: 'Space Black', value: '#1f2937' },
  ],
};

describe('ProductListItem', () => {
  it('uses the provided basePath for navigation and actions', () => {
    const onAddToCart = vi.fn();
    const onToggleWishlist = vi.fn();

    render(
      <ProductListItem
        basePath="/ogabassey"
        product={baseProduct}
        onAddToCart={onAddToCart}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={onToggleWishlist}
      />
    );

    expect(
      screen.getByRole('link', {
        name: `View ${baseProduct.name} for ${baseProduct.price}`,
      })
    ).toHaveAttribute('href', '/ogabassey/laptops/macbook-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous color' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Add to Cart/i })
    );

    expect(onToggleWishlist).toHaveBeenCalledOnce();
    expect(onAddToCart).toHaveBeenCalledWith(expect.any(Object), baseProduct);
  });

  it('links SKU-matrix products to option selection instead of quick-adding', () => {
    const onAddToCart = vi.fn();

    render(
      <ProductListItem
        basePath="/ogabassey"
        product={
          {
            ...baseProduct,
            available_conditions: ['open_box', 'used'],
            has_variants: true,
            variant_model: 'sku_matrix',
          } as Product
        }
        onAddToCart={onAddToCart}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(
      screen.getByRole('link', {
        name: `Choose options for ${baseProduct.name}`,
      })
    ).toHaveAttribute('href', '/ogabassey/laptops/macbook-pro');
    expect(
      screen.queryByRole('button', { name: /Add to Cart/i })
    ).not.toBeInTheDocument();
    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it('uses explicit mapped alt text for the rendered list image', () => {
    render(
      <ProductListItem
        basePath="/ogabassey"
        product={{
          ...baseProduct,
          image: '/macbook-silver.jpg',
          image_alt: 'Merchant-provided laptop angle',
        }}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(
      screen.getByAltText('Merchant-provided laptop angle')
    ).toBeInTheDocument();
  });

  it('falls back to the product name after selecting a non-primary list image', () => {
    render(
      <ProductListItem
        basePath="/ogabassey"
        product={{
          ...baseProduct,
          image: '/macbook-silver.jpg',
          image_alt: 'Merchant-provided laptop angle',
        }}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Space Black color' })
    );

    expect(screen.getByAltText(baseProduct.name)).toHaveAttribute(
      'src',
      '/macbook-space-black.jpg'
    );
  });

  it('uses preserved payload alt text after selecting a non-primary list image', () => {
    render(
      <ProductListItem
        basePath="/ogabassey"
        product={{
          ...baseProduct,
          image: '/macbook-silver.jpg',
          image_alt: 'Merchant-provided laptop angle',
          image_payloads: [
            { url: '/macbook-silver.jpg', alt: 'Silver laptop lid' },
            {
              url: '/macbook-space-black.jpg',
              alt: 'Space Black keyboard angle',
            },
          ],
        }}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Space Black color' })
    );

    expect(screen.getByAltText('Space Black keyboard angle')).toHaveAttribute(
      'src',
      '/macbook-space-black.jpg'
    );
  });

  it('reveals a list image that was already complete before hydration attached onLoad', () => {
    // Arrange: jsdom images are never `complete`, so simulate a warm-cache
    // SSR'd <img> by patching the prototype BEFORE render — the mount-time ref
    // callback must flip the loaded state without any onLoad event.
    const completeSpy = vi
      .spyOn(window.HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true);
    const naturalWidthSpy = vi
      .spyOn(window.HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(200);

    const { container } = render(
      <ProductListItem
        basePath="/ogabassey"
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    const image = screen.getByAltText(baseProduct.name);
    expect(image.className).toContain('opacity-100');
    expect(container.querySelector('.animate-pulse')).toBeNull();

    completeSpy.mockRestore();
    naturalWidthSpy.mockRestore();
  });

  it('renders blank-image list placeholders as decorative images', () => {
    const { container } = render(
      <ProductListItem
        basePath="/ogabassey"
        product={{
          ...baseProduct,
          image: '   ',
          images: ['  '],
          image_alt: 'Should not describe a placeholder',
        }}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    const image = container.querySelector('img');

    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('src', '/placeholder.svg');
  });

});
