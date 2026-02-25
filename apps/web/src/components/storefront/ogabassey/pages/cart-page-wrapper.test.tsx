import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ----- Mock: next/navigation -----
const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

// ----- Mock: useCart -----
const mockAddToCart = vi.fn();
const mockCart: { id: string }[] = [];

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: mockAddToCart,
    cart: mockCart,
  })),
}));

// ----- Mock: useToast -----
const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// ----- Mock: Supabase client (chainable query builder) -----
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ----- Mock: CartPage -----
vi.mock('./cart-page', () => ({
  CartPage: vi.fn(
    ({
      vatEnabled,
      vatRate,
    }: {
      vatEnabled?: boolean;
      vatRate?: number;
    }) => (
      <div
        data-testid="cart-page"
        data-vat-enabled={String(vatEnabled)}
        data-vat-rate={String(vatRate)}
      />
    ),
  ),
}));

// Import after mocks
import { useCart } from '@/hooks/use-cart';
import { CartPageWrapper } from './cart-page-wrapper';

// Helper: make useSearchParams return a given item_id string (or none)
function setItemId(value: string | null) {
  const params = new URLSearchParams();
  if (value !== null) params.set('item_id', value);
  mockUseSearchParams.mockReturnValue(params);
}

// A sample product returned by Supabase
const PRODUCT_ROW = {
  id: 'prod-1',
  name: 'Test Phone',
  price: 50000,
  compare_at_price: 60000,
  images: [{ url: 'https://example.com/img.jpg', alt: 'img', order: 0 }],
  image_hint: 'smartphone',
  slug: 'test-phone',
  manage_stock: true,
  stock_quantity: 10,
  sku: 'SKU-001',
  has_variants: false,
  brand: 'TestBrand',
  condition: 'new',
  description: 'A test phone',
};

describe('CartPageWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset cart to empty by default
    vi.mocked(useCart).mockReturnValue({
      addToCart: mockAddToCart,
      cart: [],
    } as unknown as ReturnType<typeof useCart>);

    // Default: no item_id query param
    setItemId(null);

    // Default from() stub (will be overridden per-test when needed)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    });

    // Stub window.history.replaceState so jsdom doesn't throw
    Object.defineProperty(window, 'history', {
      value: { replaceState: vi.fn() },
      writable: true,
    });
  });

  // ------------------------------------------------------------------ //
  // 1. Renders CartPage when no item_id query param
  // ------------------------------------------------------------------ //
  it('renders CartPage immediately when no item_id query param is present', () => {
    // Arrange
    setItemId(null);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    expect(screen.getByTestId('cart-page')).toBeTruthy();
  });

  // ------------------------------------------------------------------ //
  // 2. Passes vatEnabled and vatRate props to CartPage
  // ------------------------------------------------------------------ //
  it('passes vatEnabled and vatRate props through to CartPage', () => {
    // Arrange
    setItemId(null);

    // Act
    render(
      <CartPageWrapper
        merchantId="merchant-1"
        vatEnabled={true}
        vatRate={15}
      />,
    );

    // Assert
    const cartPage = screen.getByTestId('cart-page');
    expect(cartPage.getAttribute('data-vat-enabled')).toBe('true');
    expect(cartPage.getAttribute('data-vat-rate')).toBe('15');
  });

  it('passes default vatEnabled=false and vatRate=7.5 when props are omitted', () => {
    // Arrange
    setItemId(null);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    const cartPage = screen.getByTestId('cart-page');
    expect(cartPage.getAttribute('data-vat-enabled')).toBe('false');
    expect(cartPage.getAttribute('data-vat-rate')).toBe('7.5');
  });

  // ------------------------------------------------------------------ //
  // 3. Shows loading spinner while fetching
  // ------------------------------------------------------------------ //
  it('shows loading spinner text while item_id fetch is in progress', async () => {
    // Arrange: item_id present, Supabase never resolves (pending promise)
    setItemId('prod-1');

    let resolveQuery!: (v: unknown) => void;
    const pendingQuery = new Promise((resolve) => {
      resolveQuery = resolve;
    });

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    // Make the last chained call return a pending promise
    stub.eq
      .mockReturnValueOnce(stub) // .eq('merchant_id', ...)
      .mockReturnValueOnce(stub); // .eq('status', 'active') — but we override below
    stub.in.mockReturnValue({ ...stub, eq: vi.fn().mockReturnValue(pendingQuery) });
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert: loading text appears
    await waitFor(() => {
      expect(screen.getByText('Adding items to cart...')).toBeTruthy();
    });

    // Clean up the pending promise
    resolveQuery({ data: [], error: null });
  });

  // ------------------------------------------------------------------ //
  // 4. Calls addToCart with correct mapped shape when fetch succeeds
  // ------------------------------------------------------------------ //
  it('calls addToCart with correctly mapped product shape after successful fetch', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub) // .eq('merchant_id', ...)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null })); // .eq('status', 'active')
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
    });

    const [calledProduct, qty] = mockAddToCart.mock.calls[0];
    expect(qty).toBe(1);
    expect(calledProduct.id).toBe('prod-1');
    expect(calledProduct.name).toBe('Test Phone');
    expect(calledProduct.price).toBe(50000);
    expect(calledProduct.status).toBe('active');
    expect(calledProduct.image).toBe('https://example.com/img.jpg');
    expect(calledProduct.imageLarge).toBe('https://example.com/img.jpg');
    expect(calledProduct.imageHint).toBe('smartphone');
    expect(calledProduct.brand).toBe('TestBrand');
    expect(calledProduct.slug).toBe('test-phone');
    expect(calledProduct.sku).toBe('SKU-001');
    expect(calledProduct.has_variants).toBe(false);
    expect(calledProduct.compare_at_price).toBe(60000);
    expect(calledProduct.condition).toBe('new');
    expect(calledProduct.manage_stock).toBe(true);
    expect(calledProduct.stock).toBe(10);
    expect(calledProduct.gtin).toBe('');
    expect(calledProduct.mpn).toBe('');
  });

  it('shows success toast with product name after adding a single item', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to cart',
          description: 'Test Phone has been added to your cart.',
        }),
      );
    });
  });

  it('shows plural success toast when multiple items are added', async () => {
    // Arrange
    setItemId('prod-1,prod-2');

    const product2 = { ...PRODUCT_ROW, id: 'prod-2', name: 'Second Phone' };

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(
        Promise.resolve({ data: [PRODUCT_ROW, product2], error: null }),
      );
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '2 items added',
          description: '2 products have been added to your cart.',
        }),
      );
    });
    expect(mockAddToCart).toHaveBeenCalledTimes(2);
  });

  // ------------------------------------------------------------------ //
  // 5. Shows error toast when Supabase returns an error
  // ------------------------------------------------------------------ //
  it('shows destructive error toast when Supabase query returns an error', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(
        Promise.resolve({ data: null, error: { message: 'DB error' } }),
      );
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Could not add items to cart. Please try again.',
          variant: 'destructive',
        }),
      );
    });
    expect(mockAddToCart).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ //
  // 6. Shows "Product not found" toast when no products returned
  // ------------------------------------------------------------------ //
  it('shows "Product not found" toast when Supabase returns an empty array', async () => {
    // Arrange
    setItemId('prod-nonexistent');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Product not found',
          description: 'The requested product could not be found.',
          variant: 'destructive',
        }),
      );
    });
    expect(mockAddToCart).not.toHaveBeenCalled();
  });

  it('shows "Product not found" toast when Supabase returns null data', async () => {
    // Arrange
    setItemId('prod-null');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: null, error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Product not found',
          variant: 'destructive',
        }),
      );
    });
  });

  // ------------------------------------------------------------------ //
  // 7. Skips adding products already in cart
  // ------------------------------------------------------------------ //
  it('skips adding a product that is already in the cart', async () => {
    // Arrange: cart already contains prod-1
    vi.mocked(useCart).mockReturnValue({
      addToCart: mockAddToCart,
      cart: [{ id: 'prod-1' }],
    } as unknown as ReturnType<typeof useCart>);

    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert: addToCart should NOT be called because the item is already in cart
    // Give the effect time to complete
    await waitFor(() => {
      // The URL cleanup (replaceState) happens after the loop
      expect(window.history.replaceState).toHaveBeenCalled();
    });
    expect(mockAddToCart).not.toHaveBeenCalled();
    // And no success toast since addedCount === 0
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('adds only products not already in cart when some are present', async () => {
    // Arrange: cart already contains prod-1 but not prod-2
    vi.mocked(useCart).mockReturnValue({
      addToCart: mockAddToCart,
      cart: [{ id: 'prod-1' }],
    } as unknown as ReturnType<typeof useCart>);

    setItemId('prod-1,prod-2');

    const product2 = { ...PRODUCT_ROW, id: 'prod-2', name: 'Second Phone' };

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(
        Promise.resolve({ data: [PRODUCT_ROW, product2], error: null }),
      );
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert: only prod-2 is added
    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
    });
    expect(mockAddToCart.mock.calls[0][0].id).toBe('prod-2');
  });

  // ------------------------------------------------------------------ //
  // 8. Shows generic error toast when the effect throws unexpectedly
  // ------------------------------------------------------------------ //
  it('shows generic error toast when createClient throws an unexpected error', async () => {
    // Arrange
    setItemId('prod-1');

    // Make from() throw synchronously to simulate a crash inside the effect
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected crash');
    });

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive',
        }),
      );
    });
  });

  // ------------------------------------------------------------------ //
  // 9. URL cleanup — replaceState is called to remove item_id from URL
  // ------------------------------------------------------------------ //
  it('removes item_id from the URL after a successful fetch', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ //
  // 10. Process-once guard — effect does not run twice for same params
  // ------------------------------------------------------------------ //
  it('does not fetch again if the component re-renders with the same item_id', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    const { rerender } = render(<CartPageWrapper merchantId="merchant-1" />);

    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
    });

    // Re-render (same props) — processedRef.current should prevent a second fetch
    rerender(<CartPageWrapper merchantId="merchant-1" />);

    // from() should only have been called once total
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------ //
  // 11. Renders CartPage (not spinner) after fetch completes
  // ------------------------------------------------------------------ //
  it('renders CartPage after the fetch and add-to-cart flow completes', async () => {
    // Arrange
    setItemId('prod-1');

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(Promise.resolve({ data: [PRODUCT_ROW], error: null }));
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" vatEnabled={true} vatRate={10} />);

    // Assert: spinner disappears and CartPage appears
    await waitFor(() => {
      expect(screen.queryByText('Adding items to cart...')).toBeNull();
      expect(screen.getByTestId('cart-page')).toBeTruthy();
    });
  });

  // ------------------------------------------------------------------ //
  // 12. Handles image-less products gracefully
  // ------------------------------------------------------------------ //
  it('uses empty string for image when product has no images', async () => {
    // Arrange
    setItemId('prod-no-img');

    const noImageProduct = {
      ...PRODUCT_ROW,
      id: 'prod-no-img',
      images: null,
    };

    const stub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    stub.eq
      .mockReturnValueOnce(stub)
      .mockReturnValueOnce(
        Promise.resolve({ data: [noImageProduct], error: null }),
      );
    stub.in.mockReturnValue(stub);
    mockFrom.mockReturnValue(stub);

    // Act
    render(<CartPageWrapper merchantId="merchant-1" />);

    // Assert: addToCart is called with empty image strings
    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
    });
    const [calledProduct] = mockAddToCart.mock.calls[0];
    expect(calledProduct.image).toBe('');
    expect(calledProduct.imageLarge).toBe('');
  });
});
