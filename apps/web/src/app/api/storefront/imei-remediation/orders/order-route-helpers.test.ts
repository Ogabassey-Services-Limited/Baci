import { describe, expect, it } from 'vitest';
import { petrockRemediationOrderRouteHelpers as helpers } from './order-route-helpers';

describe('petrockRemediationOrderRouteHelpers', () => {
  it('compares only canonical SHA-256 identifiers', () => {
    const hash = 'a'.repeat(64);
    expect(helpers.hashesMatch(hash, hash)).toBe(true);
    expect(helpers.hashesMatch(hash, 'b'.repeat(64))).toBe(false);
    expect(helpers.hashesMatch('invalid', hash)).toBe(false);
  });

  it('replays pending and terminal order states without provider work', async () => {
    const pending = helpers.replayResponse('order-1', 'in_progress');
    expect(pending?.status).toBe(202);
    await expect(pending?.json()).resolves.toMatchObject({
      orderId: 'order-1',
      status: 'in_progress',
    });

    expect(helpers.replayResponse('order-1', 'eligible')).toBeNull();
  });
});
