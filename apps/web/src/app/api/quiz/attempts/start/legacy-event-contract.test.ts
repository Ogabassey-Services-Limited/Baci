import { describe, expect, it, vi } from 'vitest';
import { rejectLegacyV2EventStart } from './legacy-event-contract';

function client(data: unknown, error: unknown = null) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    select: vi.fn(() => builder),
  };
  return { from: vi.fn(() => builder) } as never;
}

describe('legacy quiz start contract guard', () => {
  it('requires an app update before a legacy client can start v2', async () => {
    expect(
      (await rejectLegacyV2EventStart(client({ contract_version: 2 }), 'event'))
        ?.status
    ).toBe(426);
    expect(
      await rejectLegacyV2EventStart(client({ contract_version: 1 }), 'event')
    ).toBeNull();
  });

  it('fails closed when the contract lookup fails', async () => {
    expect(
      (
        await rejectLegacyV2EventStart(
          client(null, { message: 'failed' }),
          'event'
        )
      )?.status
    ).toBe(500);
  });
});
