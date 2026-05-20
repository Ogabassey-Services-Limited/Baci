import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BnplLauncher } from './bnpl-launcher';
import { CHECKOUT_PENDING_ORDER_STORAGE_KEY } from './checkout/pending-checkout-order';

const mockPush = vi.fn();
const mockSearchParams = vi.fn();
const mockOpenCreditDirectCheckout = vi.fn();
const mockOpenCredPalCheckout = vi.fn();
const mockApiPost = vi.fn();
const mockKlumpConstructor = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: vi.fn(() => mockSearchParams()),
}));

vi.mock('next/script', () => ({
  default: () => null,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { slug: 'test-store' },
    loading: false,
  })),
}));

vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: (...args: unknown[]) =>
    mockOpenCreditDirectCheckout(...args),
}));

vi.mock('@/lib/credpal', () => ({
  openCredPalCheckout: (...args: unknown[]) =>
    mockOpenCredPalCheckout(...args),
  getCredPalKey: vi.fn(() => 'credpal_test_key'),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

describe('BnplLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/checkout/bnpl');
    window.sessionStorage.clear();
    window.Klump = mockKlumpConstructor as never;
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credit_direct',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockApiPost.mockResolvedValue({ success: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: 1000,
          customer_email: 'customer@example.com',
          customer_phone: '08012345678',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 1000,
              quantity: 1,
            },
          ],
        }),
      })
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('loads BNPL order details with merchant slug and tracking token', async () => {
    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123'
      );
    });
  });

  it('includes a persisted customer email alongside the tracking token when available', async () => {
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'tok-123',
        customerEmail: 'customer@example.com',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123&email=customer%40example.com'
      );
    });
  });

  it('falls back to the stored pending-order tracking token for legacy links', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credit_direct',
        merchant_slug: 'test-store',
      })
    );
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'stored-track-token',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=stored-track-token'
      );
    });
  });

  it('preserves trackingToken when redirecting after Credit Direct success', async () => {
    mockOpenCreditDirectCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess('ref-1');
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=ref-1&trackingToken=track-order-token'
      );
    });
  });

  it('preserves trackingToken when redirecting after CredPal success', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credpal',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockOpenCredPalCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess({ order_no: 'credpal-ref-1' });
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=credpal-ref-1&trackingToken=track-order-token'
      );
    });
  });

  it('launches Klump checkout with BAC reference and callback route', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      data: {
        merchant_reference: string;
        redirect_url: string;
      };
      publicKey: string;
    };

    expect(config.publicKey).toBe('klp_pk_test_123');
    expect(config.data.merchant_reference).toBe('BAC-ABCD12345678');
    expect(config.data.redirect_url).toContain('/checkout/bnpl?');
    expect(config.data.redirect_url).not.toContain('/test-store/checkout/bnpl?');
    expect(config.data.redirect_url).toContain('gateway=klump');
    expect(config.data.redirect_url).toContain('klump_callback=1');
    expect(config.data.redirect_url).toContain('reference=BAC-ABCD12345678');
  });

  it('records Klump callback transaction ids before redirecting to success', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
        klump_callback: '1',
        transaction_id: 'klump-txn-123',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/klump/record', {
        merchant_reference: 'BAC-ABCD12345678',
        klump_transaction_id: 'klump-txn-123',
        tracking_token: 'tok-123',
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/order-success?orderId=order-1&reference=BAC-ABCD12345678&trackingToken=tok-123'
    );
  });

  it('shows an error state and does not redirect when order fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Tracking token or email is required',
      })
    );

    const { findByRole, findByText } = render(<BnplLauncher />);

    expect(
      await findByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument();
    expect(
      await findByText('Failed to fetch order details (Status: 400)')
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
