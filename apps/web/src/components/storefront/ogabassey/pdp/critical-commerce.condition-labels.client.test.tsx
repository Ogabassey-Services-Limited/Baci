import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import {
  OgabasseyPdpCriticalCommerceConditionFact,
  OgabasseyPdpCriticalCommerceProvider,
  OgabasseyPdpCriticalCommerceSummary,
  OgabasseyPdpCriticalConditionBadge,
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

const variantCartProduct: CartProduct = {
  brand: 'Xiaomi',
  condition: 'new',
  description: 'Redmi Pad 2',
  gtin: '',
  has_variants: true,
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/redmi-pad-2.avif',
  imageHint: 'Redmi Pad 2',
  imageLarge: 'https://cdn.ogabassey.com/redmi-pad-2.avif',
  manage_stock: true,
  mpn: 'redmi-pad-2',
  name: 'Redmi Pad 2',
  price: 237_674.42,
  status: 'active',
  stock: 4,
  variants: [
    {
      attributes: { storage: '128GB' },
      condition: 'used',
      id: 'variant-used',
      merchant_id: 'merchant-1',
      price_override: 237_674.42,
      product_id: 'product-1',
      stock_quantity: 10,
    },
    {
      attributes: { storage: '128GB' },
      condition: 'open_box',
      id: 'variant-open-box',
      merchant_id: 'merchant-1',
      price_override: 278_418.6,
      product_id: 'product-1',
      stock_quantity: 8,
    },
  ],
};

beforeEach(() => {
  cartMocks.addToCart.mockClear();
  cartMocks.setIsCartOpen.mockClear();
});

describe('OgabasseyPdpCriticalCommerce condition labels', () => {
  it('updates critical condition labels from the selected variant state', () => {
    render(
      <OgabasseyPdpCriticalCommerceProvider
        cartProduct={variantCartProduct}
        variantAxes={['condition', 'storage']}
        variantCount={2}
      >
        <OgabasseyPdpCriticalConditionBadge fallbackCondition="new" />
        <OgabasseyPdpCriticalCommerceConditionFact fallbackCondition="new" />
        <OgabasseyPdpCriticalCommerceSummary />
      </OgabasseyPdpCriticalCommerceProvider>
    );

    expect(screen.getByText('Multiple Conditions')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select used condition/i })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: /select open box condition/i })
    );

    expect(screen.getByText('Multiple Conditions')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select open box condition/i })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders condition labels from fallback condition outside the provider', () => {
    render(
      <>
        <OgabasseyPdpCriticalConditionBadge fallbackCondition="open_box" />
        <OgabasseyPdpCriticalCommerceConditionFact fallbackCondition="used" />
      </>
    );

    expect(screen.getByText('Open Box')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
  });
});
