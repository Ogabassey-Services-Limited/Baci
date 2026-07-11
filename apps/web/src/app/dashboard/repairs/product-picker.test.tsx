import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./catalog-api', () => ({
  searchLinkableProducts: vi.fn(),
}));

import { searchLinkableProducts } from './catalog-api';
import ProductPicker from './product-picker';

const mockSearchLinkableProducts = vi.mocked(searchLinkableProducts);

describe('ProductPicker', () => {
  it('shows the selected product and clears it', () => {
    const onChange = vi.fn();
    render(
      <ProductPicker
        value={{ id: 'p1', name: 'iPhone 14' }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('iPhone 14')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('searches for products and selects a result', async () => {
    mockSearchLinkableProducts.mockResolvedValue([
      { id: 'p1', name: 'iPhone 14', imageUrl: null },
      { id: 'p2', name: 'iPhone 14 Pro', imageUrl: null },
    ]);
    const onChange = vi.fn();
    render(<ProductPicker value={null} onChange={onChange} />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search products' }),
      {
        target: { value: 'iphone' },
      }
    );

    await waitFor(() => {
      expect(mockSearchLinkableProducts).toHaveBeenCalledWith('iphone');
    });

    const result = await screen.findByRole('button', { name: 'iPhone 14 Pro' });
    fireEvent.click(result);

    expect(onChange).toHaveBeenCalledWith({ id: 'p2', name: 'iPhone 14 Pro' });
  });

  it('shows an error message when the search fails', async () => {
    mockSearchLinkableProducts.mockRejectedValue(new Error('network down'));
    render(<ProductPicker value={null} onChange={vi.fn()} />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search products' }),
      {
        target: { value: 'iphone' },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByText('Could not search products.')
      ).toBeInTheDocument();
    });
  });

  it('shows an empty state when no products match', async () => {
    mockSearchLinkableProducts.mockResolvedValue([]);
    render(<ProductPicker value={null} onChange={vi.fn()} />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search products' }),
      {
        target: { value: 'zzz-no-match' },
      }
    );

    await waitFor(() => {
      expect(screen.getByText('No products found.')).toBeInTheDocument();
    });
  });
});
