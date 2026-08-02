import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import {
  generateSessionId,
  logSantaInteraction,
  parseWishResult,
} from './santa-analytics';

describe('Santa analytics helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
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
      merchantSlug: 'winter-store',
      sessionId: 'session-1',
      clientIp: '1'.repeat(100),
      interactionType: 'wish_granted',
      userMessage: 'u'.repeat(600),
      santaResponse: 's'.repeat(1200),
      requestedPrice: 500,
      approvedPrice: 400,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('record_santa_interaction', {
      p_approved_price: 400,
      p_client_ip: '1'.repeat(64),
      p_discount_percentage: 20,
      p_interaction_type: 'wish_granted',
      p_merchant_slug: 'winter-store',
      p_product_name: undefined,
      p_requested_price: 500,
      p_santa_response: 's'.repeat(1000),
      p_session_id: 'session-1',
      p_user_message: 'u'.repeat(500),
    });
  });
});
