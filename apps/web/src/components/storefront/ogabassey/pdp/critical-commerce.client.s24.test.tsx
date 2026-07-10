import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import {
  OgabasseyPdpCriticalCommerceConditionFact,
  OgabasseyPdpCriticalCommerceControls,
  OgabasseyPdpCriticalCommerceProvider,
  OgabasseyPdpCriticalCommerceSummary,
  OgabasseyPdpCriticalConditionBadge,
  OgabasseyPdpCriticalProductImage,
} from './critical-commerce.client';

const cartMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  setIsCartOpen: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    addToCart: cartMocks.addToCart,
    setIsCartOpen: cartMocks.setIsCartOpen,
  }),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    loading,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    loading?: string;
    src: string;
  }) => (
    <img
      alt={alt}
      data-fetch-priority={fetchPriority}
      data-loading={loading}
      src={src}
    />
  ),
}));

// The critical LCP image now renders through CdnFormatImage (explicit
// per-format <picture>). Its real pipeline calls next/image's `getImageProps`,
// absent from the default-only next/image mock — surface it as a plain <img>
// that preserves the raw src so these variant-routing assertions stay focused
// on which image URL the commerce state selects.
vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: ({
    alt,
    fetchPriority,
    loading,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    loading?: string;
    src: string;
  }) => (
    <img
      alt={alt}
      data-fetch-priority={fetchPriority}
      data-loading={loading}
      src={src}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const jadeImage =
  'https://cdn.ogabassey.com/core-assets/products/s24-jade-green.avif';
const blackImage =
  'https://cdn.ogabassey.com/core-assets/products/s24-onyx-black.avif';

const samsungS24Product: CartProduct = {
  brand: 'Samsung',
  condition: 'open_box',
  description: 'Samsung Galaxy S24',
  gtin: '',
  has_variants: true,
  id: 'samsung-galaxy-s24',
  image: blackImage,
  imageHint: 'Samsung Galaxy S24',
  imageLarge: blackImage,
  manage_stock: false,
  mpn: 'samsung-galaxy-s24',
  name: 'Samsung Galaxy S24',
  price: 600_000,
  status: 'active',
  stock: 0,
  variants: [
    {
      attributes: { color: 'Jade Green', storage: '128GB' },
      condition: 'open_box',
      id: 'open-jade-128',
      merchant_id: 'merchant-1',
      price_override: 600_000,
      primary_image: jadeImage,
      product_id: 'samsung-galaxy-s24',
      stock_quantity: 4,
    },
    {
      attributes: { color: 'Jade Green', storage: '256GB' },
      condition: 'open_box',
      id: 'open-jade-256',
      merchant_id: 'merchant-1',
      price_override: 680_000,
      primary_image: jadeImage,
      product_id: 'samsung-galaxy-s24',
      stock_quantity: 4,
    },
    {
      attributes: { color: 'Jade Green', storage: '256GB' },
      condition: 'used',
      id: 'used-jade-256',
      merchant_id: 'merchant-1',
      price_override: 630_000,
      primary_image: jadeImage,
      product_id: 'samsung-galaxy-s24',
      stock_quantity: 4,
    },
    {
      attributes: { color: 'Onyx Black', storage: '256GB' },
      condition: 'used',
      id: 'used-black-256',
      merchant_id: 'merchant-1',
      price_override: 630_000,
      primary_image: blackImage,
      product_id: 'samsung-galaxy-s24',
      stock_quantity: 4,
    },
  ],
};

beforeEach(() => {
  cartMocks.addToCart.mockClear();
  cartMocks.setIsCartOpen.mockClear();
});

describe('Samsung Galaxy S24 critical PDP selection', () => {
  it('uses image-driven color while storage and condition update price', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={samsungS24Product}
        initialVariantSelection={{
          attributes: { color: 'Jade Green' },
          condition: 'open_box',
        }}
        variantAxes={['condition', 'storage', 'color']}
        variantCount={4}
      >
        <div data-testid="image-frame">
          <OgabasseyPdpCriticalProductImage
            alt={samsungS24Product.name}
            fallbackImage={samsungS24Product.image}
          />
          <OgabasseyPdpCriticalConditionBadge
            fallbackCondition={samsungS24Product.condition}
          />
        </div>
        <OgabasseyPdpCriticalCommerceConditionFact
          fallbackCondition={samsungS24Product.condition}
        />
        <OgabasseyPdpCriticalCommerceSummary />
        <OgabasseyPdpCriticalCommerceControls
          cartHref="/cart"
          productName={samsungS24Product.name}
        />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(
      screen.getByRole('img', { name: samsungS24Product.name })
    ).toHaveAttribute('src', jadeImage);
    expect(screen.getByText('Multiple Conditions')).toBeInTheDocument();
    expect(screen.getByText(/600,000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /select open box condition/i })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: /select 256gb storage/i })
    );

    expect(screen.getByText(/680,000/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: samsungS24Product.name })
    ).toHaveAttribute('src', jadeImage);

    fireEvent.click(
      screen.getByRole('button', { name: /select used condition/i })
    );

    expect(screen.getByText(/630,000/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select used condition/i })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'used',
        image: jadeImage,
        price: 630_000,
      }),
      1,
      expect.objectContaining({
        color: 'Jade Green',
        condition: 'used',
        storage: '256GB',
        variantId: 'used-jade-256',
      })
    );
  });
});
