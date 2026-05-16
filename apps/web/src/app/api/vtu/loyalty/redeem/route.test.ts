import { describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockPurchaseAirtime } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockPurchaseAirtime: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/kuda', () => ({
  purchaseAirtime: mockPurchaseAirtime,
}));

import { POST } from './route';

describe('POST /api/vtu/loyalty/redeem', () => {
  it('returns 410 without touching legacy redemption dependencies', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({
      error: 'VTU airtime reward redemption is temporarily disabled',
      code: 'VTU_LOYALTY_REDEMPTION_DISABLED',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
  });
});
