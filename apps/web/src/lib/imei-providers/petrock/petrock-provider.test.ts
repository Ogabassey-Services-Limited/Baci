import { describe, expect, it, vi } from 'vitest';
import { createPetrockProvider } from './petrock-provider';

const binding = {
  costUsd: 0.019,
  deviceCategories: ['smartphone'] as const,
  orderFieldName: 'IMEI',
  productId: '1955',
  provider: 'petrock' as const,
};

describe('createPetrockProvider', () => {
  it('returns a pending outcome after Petrock accepts an order', async () => {
    const submitOrder = vi.fn().mockResolvedValue({
      data: { orderUuid: 'order-123', referenceId: 'lookup-123' },
      ok: true,
      rawText: '{}',
    });
    const provider = createPetrockProvider({
      client: { getOrder: vi.fn(), submitOrder },
    });

    await expect(
      provider.submit({
        binding,
        checksIncluded: ['blacklistStatus'],
        feedbackUrl: 'https://example.com/feedback/token',
        identifier: '490154203237518',
        referenceId: 'lookup-123',
        tierName: 'Stolen Check',
      })
    ).resolves.toMatchObject({
      kind: 'pending',
      providerOrderId: 'order-123',
      providerStatus: 'new',
    });
  });

  it('classifies an ambiguous submission failure without requesting a refund', async () => {
    const provider = createPetrockProvider({
      client: {
        getOrder: vi.fn(),
        submitOrder: vi.fn().mockResolvedValue({
          kind: 'timeout',
          message: 'timeout',
          ok: false,
        }),
      },
    });

    await expect(
      provider.submit({
        binding,
        checksIncluded: ['blacklistStatus'],
        feedbackUrl: 'https://example.com/feedback/token',
        identifier: '490154203237518',
        referenceId: 'lookup-123',
        tierName: 'Stolen Check',
      })
    ).resolves.toMatchObject({ kind: 'submission_unknown' });
  });

  it('turns a successful poll into the shared complete result contract', async () => {
    const provider = createPetrockProvider({
      client: {
        getOrder: vi.fn().mockResolvedValue({
          data: {
            orderUuid: 'order-123',
            replay:
              'Model Description: iPhone 15 Pro<br>USA Blacklist: Clean<br>Sold To: Apple Store<br>Finance: Clean<br>Photo URL: https://example.com/device.jpg',
            status: 'success',
          },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
    });

    const outcome = await provider.poll({
      checksIncluded: ['device', 'blacklistStatus'],
      identifier: '490154203237518',
      providerOrderId: 'order-123',
      tierName: 'Stolen Check',
    });

    expect(outcome).toMatchObject({
      body: {
        data: {
          blacklistStatus: 'Clean',
          device: 'iPhone 15 Pro',
          imei: '490154203237518',
          soldBy: 'Apple Store',
          financeStatus: 'Clean',
          devicePhoto: 'https://example.com/device.jpg',
        },
        success: true,
      },
      kind: 'complete',
      providerStatus: 'success',
    });
  });

  it('returns a refundable failure for a definitive reject status', async () => {
    const provider = createPetrockProvider({
      client: {
        getOrder: vi.fn().mockResolvedValue({
          data: {
            orderUuid: 'order-123',
            replay: 'Rejected: unsupported identifier',
            status: 'reject',
          },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
    });

    await expect(
      provider.poll({
        checksIncluded: ['device'],
        identifier: '490154203237518',
        providerOrderId: 'order-123',
        tierName: 'Stolen Check',
      })
    ).resolves.toMatchObject({
      kind: 'failure',
      providerStatus: 'reject',
      refundReason: 'not_found',
    });
  });
});
