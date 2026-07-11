import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  finalize: vi.fn(),
  reschedule: vi.fn(),
}));

vi.mock('./petrock-lookup-state', () => ({
  finalizePetrockLookup: mocks.finalize,
  reschedulePetrockLookupPoll: mocks.reschedule,
}));

import { encryptImeiIdentifier } from '@/lib/imei-identifier-crypto';
import { resolveClaimedPetrockLookup } from './petrock-lookup-resolution';

const KEY = Buffer.alloc(32, 7).toString('base64');
const lookup = {
  id: 'lookup-1',
  identifier_ciphertext: encryptImeiIdentifier('490154203237518', KEY),
  lease_token: 'lease-1',
  provider_order_id: 'order-1',
  status: 'pending_provider' as const,
  tier: 'blacklist' as const,
};

describe('resolveClaimedPetrockLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reschedule.mockResolvedValue(true);
    mocks.finalize.mockResolvedValue(true);
  });

  it('reschedules an in-process order', async () => {
    const provider = {
      poll: vi.fn().mockResolvedValue({
        kind: 'pending',
        providerOrderId: 'order-1',
        providerStatus: 'in-process',
      }),
    };

    await expect(
      resolveClaimedPetrockLookup({
        encryptionKey: KEY,
        lookup,
        provider,
        supabaseAdmin: {} as never,
      })
    ).resolves.toMatchObject({ kind: 'pending', pollAfterMs: 5000 });
    expect(mocks.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseToken: 'lease-1',
        providerStatus: 'in-process',
      })
    );
  });

  it('reports lease loss when a pending reschedule is rejected', async () => {
    mocks.reschedule.mockResolvedValue(false);
    const provider = {
      poll: vi.fn().mockResolvedValue({
        kind: 'pending',
        providerOrderId: 'order-1',
        providerStatus: 'in-process',
      }),
    };

    await expect(
      resolveClaimedPetrockLookup({
        encryptionKey: KEY,
        lookup,
        provider,
        supabaseAdmin: {} as never,
      })
    ).resolves.toMatchObject({ kind: 'lease_lost', pollAfterMs: 5000 });
  });

  it('atomically finalizes a successful result', async () => {
    const provider = {
      poll: vi.fn().mockResolvedValue({
        body: {
          data: { device: 'iPhone', imei: '490154203237518' },
          success: true,
          tier: { checksIncluded: ['blacklistStatus'], name: 'Blacklist' },
        },
        kind: 'complete',
        providerStatus: 'success',
        rawResponseText: '{}',
        status: 200,
      }),
    };

    const result = await resolveClaimedPetrockLookup({
      encryptionKey: KEY,
      lookup,
      provider,
      supabaseAdmin: {} as never,
    });

    expect(result).toMatchObject({
      body: { lookupId: 'lookup-1' },
      kind: 'complete',
      status: 200,
    });
    expect(mocks.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ lookupId: 'lookup-1' }),
        leaseToken: 'lease-1',
        terminalStatus: 'completed',
      })
    );
  });

  it('does not return a terminal result after losing the finalization lease', async () => {
    mocks.finalize.mockResolvedValue(false);
    const provider = {
      poll: vi.fn().mockResolvedValue({
        body: {
          data: { device: 'iPhone', imei: '490154203237518' },
          success: true,
          tier: { checksIncluded: ['blacklistStatus'], name: 'Blacklist' },
        },
        kind: 'complete',
        providerStatus: 'success',
        rawResponseText: '{}',
        status: 200,
      }),
    };

    await expect(
      resolveClaimedPetrockLookup({
        encryptionKey: KEY,
        lookup,
        provider,
        supabaseAdmin: {} as never,
      })
    ).resolves.toMatchObject({ kind: 'lease_lost' });
  });
});
