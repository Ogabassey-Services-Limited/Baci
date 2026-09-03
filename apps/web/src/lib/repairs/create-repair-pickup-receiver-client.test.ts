import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ role: 'admin' })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: mocks.createClient,
}));

describe('createRepairPickupReceiverClient', () => {
  it('constructs the server-only admin client for the receiver RPC', async () => {
    const { createRepairPickupReceiverClient } = await import(
      './create-repair-pickup-receiver-client'
    );

    expect(createRepairPickupReceiverClient()).toEqual({ role: 'admin' });
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });
});
