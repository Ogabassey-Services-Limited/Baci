import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProductGrid } from './product-embed-grid';

const product = {
  compare_at_price: 1500,
  id: 'product-1',
  images: ['https://cdn.example.com/bag.jpg'],
  name: 'Leather Bag',
  price: 1000,
  slug: 'leather-bag',
};

describe('ProductGrid', () => {
  it('links a discounted product inside a safe merchant storefront', () => {
    render(<ProductGrid merchantSlug="baci-store" products={[product]} />);

    const productLinks = screen.getAllByRole('link', { name: /leather bag/i });
    expect(productLinks).toHaveLength(2);
    for (const link of productLinks) {
      expect(link).toHaveAttribute('href', '/baci-store/products/leather-bag');
    }
    expect(screen.getByText('-33%')).toBeInTheDocument();
  });

  it('adds the selected product without navigating away', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    render(<ProductGrid onAddToCart={onAddToCart} products={[product]} />);

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(onAddToCart).toHaveBeenCalledWith('product-1');
  });
});
