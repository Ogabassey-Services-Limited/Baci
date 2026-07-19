// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveAgenticPaystackDvaCompletionGate } from './agentic-paystack-dva-completion-gate';

describe('resolveAgenticPaystackDvaCompletionGate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects Paystack completion while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        paymentProvider: 'paystack',
      })
    ).toBe('reject_paused');
  });

  it('does not affect pay on delivery while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        paymentProvider: 'pay_on_delivery',
      })
    ).toBe('continue');
  });

  it('does not affect Google Pay while paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        paymentProvider: 'google_pay',
      })
    ).toBe('continue');
  });

  it('continues a new Paystack completion while enabled', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'enabled');

    expect(
      resolveAgenticPaystackDvaCompletionGate({
        paymentProvider: 'paystack',
      })
    ).toBe('continue');
  });
});
