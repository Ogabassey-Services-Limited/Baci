import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CryptoCheckoutPage } from './crypto-checkout';

const mockPush = vi.fn();
const mockSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
    },
    loading: false,
  })),
}));

describe('CryptoCheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockSearchParams.mockReturnValue(
      new URLSearchParams(
        'orderId=order-1&amount=12000&merchant_slug=test-store&tracking_token=track-order-token'
      )
    );
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          reference: 'crypto-ref-123',
          crypto_payment: {
            address: 'T123456789',
            chain: 'TRX',
            currency: 'USDT',
            amount: 120000,
            confirmation_time: '1-3 minutes',
            payment_id: 'payment-1',
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'confirmed',
        }),
      }) as typeof fetch;
  });

  it('preserves trackingToken in the crypto success redirect', async () => {
    render(<CryptoCheckoutPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /i've sent the payment/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /i've sent the payment/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/status?gateway=juicyway&payment_id=payment-1'
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/test-store/order-success?type=crypto&orderId=order-1&reference=crypto-ref-123&trackingToken=track-order-token'
      );
    }, { timeout: 3000 });
  });
});
