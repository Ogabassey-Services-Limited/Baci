import { describe, expect, it } from 'vitest';
import {
  createVirtualTerminalSchema,
  virtualTerminalListQuerySchema,
} from './virtual-terminal-request-schemas';

const merchantId = '22222222-2222-4222-8222-222222222222';

describe('virtual terminal request schemas', () => {
  it('accepts a selected merchant for list and create requests', () => {
    expect(virtualTerminalListQuerySchema.parse({ merchantId })).toEqual({
      merchantId,
    });
    expect(
      createVirtualTerminalSchema.parse({ merchantId, name: 'Merchant B Till' })
    ).toEqual({ merchantId, name: 'Merchant B Till', destinations: [] });
  });

  it('rejects malformed selected merchant IDs', () => {
    expect(
      virtualTerminalListQuerySchema.safeParse({ merchantId: 'merchant-b' })
        .success
    ).toBe(false);
    expect(
      createVirtualTerminalSchema.safeParse({
        merchantId: 'merchant-b',
        name: 'Merchant B Till',
      }).success
    ).toBe(false);
  });
});
