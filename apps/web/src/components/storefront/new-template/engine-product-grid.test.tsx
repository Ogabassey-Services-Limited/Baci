import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('./interactive-product-grid', () => ({
  InteractiveProductGrid: ({
    products,
    title,
  }: {
    products?: { name: string }[];
    title?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      <ul>
        {(products ?? []).map((product) => (
          <li key={product.name}>{product.name}</li>
        ))}
      </ul>
    </div>
  ),
}));

import { EngineProductGrid } from './engine-product-grid';

describe('EngineProductGrid', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mock products immediately for demo slugs without fetching', () => {
    render(<EngineProductGrid storeSlug="ogabassey" />);

    expect(screen.getByText('iPhone 15 Pro Max')).toBeInTheDocument();
    expect(screen.queryByText('Loading products…')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders mock products immediately when useMockData is set', () => {
    render(<EngineProductGrid storeSlug="real-store" useMockData />);

    expect(screen.getByText('iPhone 15 Pro Max')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the loading state, then live products after the fetch settles', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        products: [
          {
            id: 'p1',
            name: 'Live Product',
            price: 250000,
            image: '/live.jpg',
            manage_stock: false,
          },
        ],
      }),
    });

    render(<EngineProductGrid storeSlug="real-store" title="Top Picks" />);

    expect(screen.getByText('Loading products…')).toBeInTheDocument();

    expect(await screen.findByText('Live Product')).toBeInTheDocument();
    expect(screen.getByText('Top Picks')).toBeInTheDocument();
    expect(screen.queryByText('Loading products…')).not.toBeInTheDocument();
  });

  it('falls back to mock products when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error('network down'));

    render(<EngineProductGrid storeSlug="real-store" />);

    expect(await screen.findByText('iPhone 15 Pro Max')).toBeInTheDocument();
  });

  it('resets to the loading state and refetches when storeSlug changes', async () => {
    fetchMock.mockImplementation((url: string) => {
      const name = url.includes('store-a') ? 'Product A' : 'Product B';
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            products: [
              {
                id: name,
                name,
                price: 100000,
                image: '/p.jpg',
                manage_stock: false,
              },
            ],
          }),
      });
    });

    const { rerender } = render(<EngineProductGrid storeSlug="store-a" />);
    expect(await screen.findByText('Product A')).toBeInTheDocument();

    rerender(<EngineProductGrid storeSlug="store-b" />);

    expect(screen.getByText('Loading products…')).toBeInTheDocument();
    expect(screen.queryByText('Product A')).not.toBeInTheDocument();

    expect(await screen.findByText('Product B')).toBeInTheDocument();
  });
});
