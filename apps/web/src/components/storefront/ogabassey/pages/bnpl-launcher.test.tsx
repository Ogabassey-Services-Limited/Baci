import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BnplLauncher } from './bnpl-launcher';

const mockPush = vi.fn();
const mockSearchParams = vi.fn();
const mockOpenCredPalCheckout = vi.fn();
const mockOpenCreditDirectCheckout = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { slug: 'test-store' },
    loading: false,
  })),
}));

vi.mock('@/lib/credpal', () => ({
  openCredPalCheckout: (...args: unknown[]) => mockOpenCredPalCheckout(...args),
  getCredPalKey: () => 'test-credpal-key',
}));

vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: (...args: unknown[]) =>
    mockOpenCreditDirectCheckout(...args),
}));

describe('BnplLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(
      new URLSearchParams(
        'orderId=order-1&gateway=credpal&merchant_slug=test-store'
      )
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'order-1',
        total: 12000,
        customer_email: 'john@example.com',
        customer_name: 'John Doe',
        customer_phone: '+2348012345678',
        tracking_token: 'track-order-token',
        items: [
          {
            product_id: 'product-1',
            name: 'Test Product',
            price: 12000,
            quantity: 1,
          },
        ],
      }),
    }) as typeof fetch;
  });

  it('preserves trackingToken in the CredPal success redirect', async () => {
    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockOpenCredPalCheckout).toHaveBeenCalled();
    });

    const checkoutArgs = mockOpenCredPalCheckout.mock.calls.at(-1)?.[0] as {
      onSuccess: (data: { order_no: string }) => void;
    };

    checkoutArgs.onSuccess({ order_no: 'credpal-ref-123' });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=credpal-ref-123&trackingToken=track-order-token'
      );
    });
  });

  it('preserves trackingToken in the Credit Direct success redirect', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams(
        'orderId=order-1&gateway=credit_direct&merchant_slug=test-store'
      )
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalled();
    });

    const checkoutArgs = mockOpenCreditDirectCheckout.mock.calls.at(-1)?.[0] as {
      onSuccess: (reference: string) => void;
    };

    checkoutArgs.onSuccess('credit-direct-ref-123');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=credit-direct-ref-123&trackingToken=track-order-token'
      );
    });
  });
});
