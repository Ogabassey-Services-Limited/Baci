import { describe, expect, it } from 'vitest';
import { isMcpAgenticPaystackDvaEnabled } from './agentic-paystack-dva-mode';

describe('isMcpAgenticPaystackDvaEnabled', () => {
  it('accepts only exact enabled and paused values', () => {
    expect(
      isMcpAgenticPaystackDvaEnabled({
        AGENTIC_PAYSTACK_DVA_MODE: 'enabled',
        NODE_ENV: 'production',
      })
    ).toBe(true);
    expect(
      isMcpAgenticPaystackDvaEnabled({
        AGENTIC_PAYSTACK_DVA_MODE: 'paused',
        NODE_ENV: 'production',
      })
    ).toBe(false);
  });

  it('keeps the non-production missing-value compatibility default', () => {
    expect(isMcpAgenticPaystackDvaEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it.each([undefined, '', ' enabled ', 'PAUSED', 'unknown'])(
    'fails closed for production mode %j',
    (mode) => {
      expect(() =>
        isMcpAgenticPaystackDvaEnabled({
          AGENTIC_PAYSTACK_DVA_MODE: mode,
          NODE_ENV: 'production',
        })
      ).toThrow(
        'AGENTIC_PAYSTACK_DVA_MODE must be exactly "enabled" or "paused"'
      );
    }
  );
});
