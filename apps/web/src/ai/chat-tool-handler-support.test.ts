import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

import { createChatToolSupabaseClient } from './chat-tool-handler-support';

describe('createChatToolSupabaseClient', () => {
  it('passes the resolved merchant and session context to the scoped client', () => {
    const client = { from: vi.fn(), rpc: vi.fn() };
    const merchant = {
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
    };
    mocks.createAgenticScopedSupabaseClient.mockReturnValue(client);

    expect(createChatToolSupabaseClient(merchant, 'session-1')).toBe(client);
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: merchant.id,
      merchantSlug: merchant.slug,
      sessionId: 'session-1',
    });
  });
});
