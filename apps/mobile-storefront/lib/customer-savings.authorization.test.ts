import { describe, expect, it } from '@jest/globals';
import { mockFetchWithTimeout } from '@/lib/wallet-top-up.test-utils';

const {
  confirmSavingsAuthorization,
  initializeSavingsAuthorization,
  listCustomerPaymentMethods,
  SavingsAuthorizationStillProcessingError,
  waitForSavingsAuthorizationConfirmation,
} =
  require('@/lib/customer-savings') as typeof import('@/lib/customer-savings');

describe('customer savings authorization api client', () => {
  it('initializes savings card authorization', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        authorization_url: 'https://checkout.example.com/pay',
        checkout_url: 'https://checkout.example.com/pay',
        gateway: 'paystack',
        reference: 'SAV-AUTH-123',
        success: true,
      }),
    });

    await expect(
      initializeSavingsAuthorization({ amount: 100 })
    ).resolves.toEqual({
      authorization_url: 'https://checkout.example.com/pay',
      checkout_url: 'https://checkout.example.com/pay',
      gateway: 'paystack',
      reference: 'SAV-AUTH-123',
      success: true,
    });
  });

  it('lists saved customer payment methods for savings setup', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        methods: [
          {
            bank: 'Access Bank',
            brand: 'visa',
            exp_month: '08',
            exp_year: '2030',
            id: 'card-1',
            is_default: true,
            label: 'Access Bank ending 1234',
            last4: '1234',
            provider: 'paystack',
          },
        ],
      }),
    });

    await expect(listCustomerPaymentMethods({})).resolves.toEqual([
      expect.objectContaining({
        id: 'card-1',
        is_default: true,
        label: 'Access Bank ending 1234',
      }),
    ]);
  });

  it('confirms only the payment method processed for an authorization reference', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        reference: 'SAV-AUTH-123',
        savedPaymentMethodId: 'card-1',
        status: 'successful',
        success: true,
      }),
    });

    await expect(
      confirmSavingsAuthorization({ reference: 'SAV-AUTH-123' })
    ).resolves.toMatchObject({
      savedPaymentMethodId: 'card-1',
      status: 'successful',
    });
  });

  it('keeps savings authorization retryable while the reference is processing', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        reference: 'SAV-AUTH-123',
        status: 'processing',
      }),
    });

    await expect(
      waitForSavingsAuthorizationConfirmation({
        maxAttempts: 1,
        reference: 'SAV-AUTH-123',
      })
    ).rejects.toBeInstanceOf(SavingsAuthorizationStillProcessingError);
  });

  it('does not start savings authorization polling after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForSavingsAuthorizationConfirmation({
        maxAttempts: 2,
        reference: 'SAV-AUTH-123',
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});
