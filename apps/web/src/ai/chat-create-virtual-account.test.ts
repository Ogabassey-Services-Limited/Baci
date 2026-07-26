import { describe, expect, it, vi } from 'vitest';
import { createVirtualAccountForTenant } from './chat-create-virtual-account';
import type { ChatToolTenantClient } from './chat-tool-result-types';

describe('createVirtualAccountForTenant', () => {
  it('blocks creation while Kuda is not integrated without returning a fake account', async () => {
    const result = { data: { id: 'order-9' }, error: null };
    const query = Object.assign(Promise.resolve(result), {
      insert: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn(() => Promise.resolve(result)),
    });
    const scoped = {
      merchantId: 'merchant-1',
      supabase: { from: vi.fn(() => query) } as never,
    } satisfies ChatToolTenantClient;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await createVirtualAccountForTenant(
      {
        items: [{ productId: 'p1', name: 'Phone', price: 1000, quantity: 2 }],
        amount: 2000,
        customerEmail: 'a@b.test',
        customerName: 'A',
      },
      'session-1',
      scoped
    );

    expect(response.success).toBe(false);
    expect(response.orderId).toBe('order-9');
    expect(response.error).toContain('temporarily unavailable');
  });
});
