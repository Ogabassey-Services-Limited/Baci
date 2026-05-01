import { beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseCheckoutPaymentClaim } from '@/lib/agentic/checkout-payment-claim';
import { releaseCheckoutPaymentClaimAfterFailure } from '@/lib/agentic/checkout-payment-claim-release';
import { logger } from '@/lib/logger';

vi.mock('@/lib/agentic/checkout-payment-claim', () => ({
  releaseCheckoutPaymentClaim: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const releaseInput = {
  buyer: {
    email: 'buyer@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone_number: '+2348012345678',
  },
  claimReference: 'claim-1',
  failureDetails: { payment_error: 'provider_down' },
  merchantId: 'merchant-1',
  metadata: { agentic: {} },
  sessionId: 'agentic_session_1',
  supabase: {},
};

describe('releaseCheckoutPaymentClaimAfterFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs when claim release does not complete', async () => {
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: {
        code: 'PGRST000',
        details: '',
        hint: '',
        message: 'locked',
        name: 'PostgrestError',
        toJSON() {
          return this;
        },
      },
      released: false,
    });

    await releaseCheckoutPaymentClaimAfterFailure(releaseInput as never);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Checkout payment claim release did not complete',
      })
    );
  });

  it('does not log when claim release succeeds', async () => {
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });

    await releaseCheckoutPaymentClaimAfterFailure(releaseInput as never);

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs when claim release throws', async () => {
    vi.mocked(releaseCheckoutPaymentClaim).mockRejectedValue(new Error('boom'));

    await releaseCheckoutPaymentClaimAfterFailure(releaseInput as never);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Checkout payment claim release failed',
      })
    );
  });
});
