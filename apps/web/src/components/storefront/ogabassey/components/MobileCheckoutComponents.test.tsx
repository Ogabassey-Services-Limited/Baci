import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart';
import { MobileOrderSummary } from './MobileCheckoutComponents';

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

const cartItem = {
  brand: 'Baci',
  cartItemId: 'cart-item-1',
  description: 'A phone',
  gtin: '',
  id: 'product-1',
  image: '/phone.png',
  imageHint: '',
  imageLarge: '/phone.png',
  manage_stock: true,
  mpn: '',
  name: 'Baci Phone',
  price: 120_000,
  quantity: 2,
  status: 'active',
  stock: 5,
} satisfies CartItem;

describe('MobileOrderSummary', () => {
  it('keeps order summary thumbnails on the neutral image surface', () => {
    render(
      <MobileOrderSummary
        cart={[cartItem]}
        cartTotal={240_000}
        deliveryCost={0}
        deliveryMethod="pickup"
        giftWrappingCost={0}
        payWithWallet={false}
        remainingAmount={240_000}
        walletAmountUsed={0}
        walletBalance={0}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /show order summary/i })
    );

    expect(screen.getByAltText('Baci Phone').parentElement).toHaveClass(
      'ogabassey-product-card-image-surface'
    );
    expect(screen.getByAltText('Baci Phone')).toHaveAttribute(
      'src',
      '/phone.png'
    );
  });
});
