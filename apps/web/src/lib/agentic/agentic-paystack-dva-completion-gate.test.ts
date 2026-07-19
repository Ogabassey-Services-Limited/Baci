// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveAgenticPaystackDvaCompletionGate } from './agentic-paystack-dva-completion-gate';

describe('resolveAgenticPaystackDvaCompletionGate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows an existing complete payment-pending response while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        existingPaymentStateStatus: 200,
        paymentProvider: 'paystack',
        paymentState: 'payment_pending',
      })
    ).toBe('replay_existing_payment');
  });

  it.each([
    'claiming_payment',
    'payment_account_ready',
    'order_finalizing',
  ])('rejects %s through the normal route while paused', (paymentState) => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        existingPaymentStateStatus: null,
        paymentProvider: 'paystack',
        paymentState,
      })
    ).toBe('reject_paused');
  });

  it('rejects a new Paystack completion while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        existingPaymentStateStatus: null,
        paymentProvider: 'paystack',
        paymentState: null,
      })
    ).toBe('reject_paused');
  });

  it('does not affect pay on delivery while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        existingPaymentStateStatus: null,
        paymentProvider: 'pay_on_delivery',
        paymentState: null,
      })
    ).toBe('continue');
  });

  it('continues a new Paystack completion while enabled', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'enabled');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        existingPaymentStateStatus: null,
        paymentProvider: 'paystack',
        paymentState: null,
      })
    ).toBe('continue');
  });
});
