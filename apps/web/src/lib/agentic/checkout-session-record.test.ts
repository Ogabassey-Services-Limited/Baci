import { describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_SESSION_MUTABLE_STATUSES,
  getAgenticCheckoutSession,
} from '@/lib/agentic/checkout-session-record';

describe('agentic checkout session record', () => {
  it('scopes session lookups by public session id and merchant id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { session_id: 'agentic_session_1' },
      error: null,
    });
    const eq = vi.fn(() => ({ eq, maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await getAgenticCheckoutSession({
      merchantId: 'merchant-1',
      sessionId: 'agentic_session_1',
      supabase: { from } as never,
    });

    expect(result.data).toEqual({ session_id: 'agentic_session_1' });
    expect(from).toHaveBeenCalledWith('checkout_sessions');
    expect(eq).toHaveBeenCalledWith('session_id', 'agentic_session_1');
    expect(eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('returns Supabase errors from session lookups', async () => {
    const lookupError = { message: 'lookup failed' };
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: lookupError,
    });
    const eq = vi.fn(() => ({ eq, maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await getAgenticCheckoutSession({
      merchantId: 'merchant-1',
      sessionId: 'agentic_session_1',
      supabase: { from } as never,
    });

    expect(result).toEqual({ data: null, error: lookupError });
  });

  it('limits mutable session writes to pending and processing states', () => {
    expect(CHECKOUT_SESSION_MUTABLE_STATUSES).toEqual([
      'pending',
      'processing',
    ]);
  });
});
