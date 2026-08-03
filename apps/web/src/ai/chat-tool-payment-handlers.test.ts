import { describe, expect, it, vi } from 'vitest';
import type { ChatToolSupabaseClient } from './chat-tool-handlers';

import { handleCheckPaymentStatus } from './chat-tool-payment-handlers';

describe('chat-tool-payment-handlers', () => {
  it('returns not_found when the session has no matching order', async () => {
    const query = Object.assign(Promise.resolve({ data: null, error: null }), {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    } as unknown as ChatToolSupabaseClient;

    const result = await handleCheckPaymentStatus(
      { customerEmail: 'customer@example.com' },
      'session-1',
      { id: 'merchant-1', slug: 'winter-store', businessName: 'Winter Store' },
      supabase
    );

    expect(result).toEqual({ status: 'not_found' });
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
  });
});
