import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import {
  generateSessionId,
  logSantaInteraction,
  parseWishResult,
} from './santa-analytics';

describe('Santa analytics helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: mocks.insert })),
    });
  });

  it('generates a stable privacy-preserving session id', () => {
    expect(generateSessionId('127.0.0.1')).toBe(generateSessionId('127.0.0.1'));
    expect(generateSessionId('127.0.0.1')).toHaveLength(16);
    expect(generateSessionId('127.0.0.1')).not.toBe(
      generateSessionId('127.0.0.2')
    );
  });

  it('parses an approved wish and negotiated price', () => {
    expect(
      parseWishResult('ACTION:ADD_TO_CART|PRODUCT:Phone|PRICE:₦450,000')
    ).toEqual({
      type: 'wish_granted',
      productName: 'Phone',
      approvedPrice: 450000,
    });
  });

  it('logs bounded interaction fields and discount percentage', async () => {
    await logSantaInteraction({
      merchantId: 'merchant-1',
      sessionId: 'session-1',
      clientIp: '1'.repeat(100),
      interactionType: 'wish_granted',
      userMessage: 'u'.repeat(600),
      santaResponse: 's'.repeat(1200),
      requestedPrice: 500,
      approvedPrice: 400,
    });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_ip: '1'.repeat(64),
        user_message: 'u'.repeat(500),
        santa_response: 's'.repeat(1000),
        discount_percentage: 20,
      })
    );
  });
});
