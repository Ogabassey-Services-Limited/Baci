import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCart } from '@/hooks/cart';
import { createClient } from '@/lib/supabase/client';
import { CartPageWrapper } from './cart-page-wrapper';

const mockToast = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('./cart-page', () => ({
  CartPage: () => <div>Cart page</div>,
}));

const { useSearchParams } = await import('next/navigation');

function setupProductsQuery(result: {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
}) {
  const productsQuery = {
    eq: vi.fn(() => productsQuery),
    in: vi.fn(() => productsQuery),
    select: vi.fn(() => productsQuery),
    then: vi.fn(
      (
        resolve: (value: typeof result) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject)
    ),
  };
  vi.mocked(createClient).mockReturnValue({
    from: vi.fn(() => productsQuery),
  } as unknown as ReturnType<typeof createClient>);

  return productsQuery;
}

	describe('CartPageWrapper', () => {
	  beforeEach(() => {
	    vi.clearAllMocks();
	    window.history.pushState({}, '', '/ogabassey/cart');
	    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams(
        'item_id=55555555-5555-4555-8555-555555555555&quiz_award_id=44444444-4444-4444-8444-444444444444&quiz_voucher_token=signed-token'
      ) as ReturnType<typeof useSearchParams>
    );
  });

  it('adds quiz prize products to cart with voucher metadata from the URL', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);
    setupProductsQuery({
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          images: [{ url: 'https://cdn.example.com/iphone.png' }],
          name: 'iPhone 15 Pro Max',
          price: 2100000,
          status: 'active',
        },
      ],
      error: null,
    });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(addToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '55555555-5555-4555-8555-555555555555',
          image: 'https://cdn.example.com/iphone.png',
          name: 'iPhone 15 Pro Max',
        }),
        1,
        expect.objectContaining({
          platform: 'quiz_prize',
          quizAwardId: '44444444-4444-4444-8444-444444444444',
          quizVoucherToken: 'signed-token',
        })
      );
    });
  });

  it('blocks a prize claim into a cart that already holds paid items', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      // A normal paid line (no quizAwardId) already in the cart.
      cart: [{ id: 'paid-1', quantity: 1 }],
    } as unknown as ReturnType<typeof useCart>);
    setupProductsQuery({
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          images: [{ url: 'https://cdn.example.com/iphone.png' }],
          name: 'iPhone 15 Pro Max',
          price: 2100000,
          status: 'active',
        },
      ],
      error: null,
    });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Check out your prize separately',
          variant: 'destructive',
        })
      );
    });
    // The prize is NOT added to the mixed cart.
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('does not fetch products when item_id is missing', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams(
        'quiz_award_id=44444444-4444-4444-8444-444444444444&quiz_voucher_token=signed-token'
      ) as ReturnType<typeof useSearchParams>
    );

    render(<CartPageWrapper merchantId="merchant-1" />);

    expect(createClient).not.toHaveBeenCalled();
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('shows a destructive toast when the product cannot be found', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);
    setupProductsQuery({ data: [], error: null });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Product not found',
          variant: 'destructive',
        })
      );
    });
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('shows a destructive toast when product lookup fails', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);
    setupProductsQuery({
      data: null,
      error: { message: 'database unavailable' },
    });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      );
    });
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('does not add inactive products returned by the lookup', async () => {
    const addToCart = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      addToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);
    setupProductsQuery({
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          images: [],
          name: 'Inactive iPhone',
          price: 2100000,
          status: 'draft',
        },
      ],
      error: null,
    });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Product not found',
          variant: 'destructive',
        })
      );
    });
    expect(addToCart).not.toHaveBeenCalled();
  });

	  it('does not add the same quiz award twice', async () => {
	    const addToCart = vi.fn();
	    vi.mocked(useCart).mockReturnValue({
	      addToCart,
      cart: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          quizAwardId: '44444444-4444-4444-8444-444444444444',
        },
      ],
    } as unknown as ReturnType<typeof useCart>);
    const productsQuery = setupProductsQuery({
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          images: [],
          name: 'iPhone 15 Pro Max',
          price: 2100000,
          status: 'active',
        },
      ],
      error: null,
    });

    render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(productsQuery.then).toHaveBeenCalled();
	    });
	    expect(addToCart).not.toHaveBeenCalled();
	  });

	  it('preserves unrelated query parameters when cleaning up quiz prize cart params', async () => {
	    const addToCart = vi.fn();
	    vi.mocked(useCart).mockReturnValue({
	      addToCart,
	      cart: [],
	    } as unknown as ReturnType<typeof useCart>);
	    setupProductsQuery({
	      data: [
	        {
	          id: '55555555-5555-4555-8555-555555555555',
	          images: [],
	          name: 'iPhone 15 Pro Max',
	          price: 2100000,
	          status: 'active',
	        },
	      ],
	      error: null,
	    });
	    window.history.pushState(
	      {},
	      '',
	      '/ogabassey/cart?item_id=55555555-5555-4555-8555-555555555555&quiz_award_id=44444444-4444-4444-8444-444444444444&quiz_voucher_token=signed-token&ref=share#summary'
	    );

	    render(<CartPageWrapper merchantId="merchant-1" />);

	    await waitFor(() => {
	      expect(addToCart).toHaveBeenCalledOnce();
	    });
	    expect(window.location.pathname).toBe('/ogabassey/cart');
	    expect(window.location.search).toBe('?ref=share');
	    expect(window.location.hash).toBe('#summary');
	  });
	});
