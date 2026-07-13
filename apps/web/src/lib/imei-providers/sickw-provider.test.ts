import { describe, expect, it, vi } from 'vitest';
import { createSickwProvider } from './sickw-provider';

const mockRequestSickwCheck = vi.hoisted(() => vi.fn());

vi.mock('@/lib/imei-lookup-fulfillment', () => ({
  requestSickwCheck: mockRequestSickwCheck,
}));

describe('createSickwProvider', () => {
  it('maps the existing synchronous Sickw result to a complete outcome', async () => {
    mockRequestSickwCheck.mockResolvedValue({
      body: { data: { imei: '490154203237518' }, success: true },
      ok: true,
      rawResponseText: '{}',
      sickwStatus: 'success',
      status: 200,
    });
    const provider = createSickwProvider({ apiKey: 'sickw-key' });

    await expect(
      provider.submit({
        binding: {
          costUsd: 0.04,
          deviceCategories: ['smartphone'],
          orderFieldName: 'imei',
          productId: '54',
          provider: 'sickw',
        },
        checksIncluded: ['blacklistStatus'],
        feedbackUrl: '',
        identifier: '490154203237518',
        referenceId: 'lookup-123',
        tierName: 'Stolen Check',
      })
    ).resolves.toMatchObject({ kind: 'complete', providerStatus: 'success' });
  });
});
