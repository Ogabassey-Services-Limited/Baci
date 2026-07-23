// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAgenticPaystackDvaPaused } from './agentic-paystack-dva-paused';

describe('isAgenticPaystackDvaPaused', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when the exact mode is paused', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');

    expect(isAgenticPaystackDvaPaused()).toBe(true);
  });

  it('returns false when the exact mode is enabled', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'enabled');

    expect(isAgenticPaystackDvaPaused()).toBe(false);
  });
});
