// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAgenticPaystackDvaMode } from './agentic-paystack-dva-mode';

describe('getAgenticPaystackDvaMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    'enabled',
    'paused',
  ] as const)('accepts the exact %s mode', (mode) => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', mode);

    expect(getAgenticPaystackDvaMode()).toBe(mode);
  });

  it('defaults to enabled only outside production when the mode is missing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', undefined);

    expect(getAgenticPaystackDvaMode()).toBe('enabled');
  });

  it.each([
    undefined,
    '',
    ' enabled ',
    'ENABLED',
    'unknown',
  ])('rejects an absent or invalid production mode: %s', (mode) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', mode);

    expect(() => getAgenticPaystackDvaMode()).toThrow(
      /AGENTIC_PAYSTACK_DVA_MODE/
    );
  });

  it.each([
    '',
    ' paused ',
    'PAUSED',
    'unknown',
  ])('rejects an invalid non-production mode: %s', (mode) => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', mode);

    expect(() => getAgenticPaystackDvaMode()).toThrow(
      /AGENTIC_PAYSTACK_DVA_MODE/
    );
  });
});
