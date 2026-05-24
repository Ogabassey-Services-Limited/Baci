import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from './types';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '/ogabassey' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, ...imageProps } = props;
    delete imageProps.fill;

    return <img {...imageProps} alt={String(alt ?? '')} />;
  },
}));

import { ProductGridItem } from './product-grid-item';

const productWithColors: Product = {
  id: 'product-1',
  name: 'iPhone 15 Pro',
  price: '₦1,200,000',
  image: '/iphone.jpg',
  images: ['/iphone-black.jpg', '/iphone-silver.jpg', '/iphone-gold.jpg'],
  category: 'smartphones',
  slug: 'iphone-15-pro',
  categories: { slug: 'smartphones' },
  rating: 4.8,
  reviews: 12,
  description: 'Flagship phone',
  colors: [
    { name: 'Black', value: '#000000' },
    { name: 'Silver', value: '#cccccc' },
    { name: 'Gold', value: '#d4af37' },
  ],
};

describe('ProductGridItem', () => {
  it('exposes color swatches as a keyboard-navigable radio group', async () => {
    const user = userEvent.setup();

    render(
      <ProductGridItem
        product={productWithColors}
        onAddToCart={vi.fn()}
        isAdded={false}
        viewMode="grid"
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    const colorGroup = screen.getByRole('radiogroup', {
      name: 'iPhone 15 Pro colors',
    });
    const [black, silver, gold] = within(colorGroup).getAllByRole('radio');

    expect(black).toHaveAccessibleName('Black');
    expect(black).toHaveAttribute('aria-checked', 'true');
    expect(black).not.toHaveAttribute('aria-pressed');
    expect(silver).toHaveAttribute('aria-checked', 'false');

    black.focus();
    await user.keyboard('{ArrowRight}');

    expect(silver).toHaveFocus();
    expect(black).toHaveAttribute('aria-checked', 'false');
    expect(silver).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{End}');

    expect(gold).toHaveFocus();
    expect(gold).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Home}');

    expect(black).toHaveFocus();
    expect(black).toHaveAttribute('aria-checked', 'true');
  });
});
