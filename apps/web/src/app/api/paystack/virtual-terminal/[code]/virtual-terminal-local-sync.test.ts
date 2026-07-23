import { describe, expect, it, vi } from 'vitest';

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import {
  clearLegacyTerminalCode,
  syncTerminalRecord,
  verifyTerminalOwnership,
} from './virtual-terminal-local-sync';

function createChain(result: { data: unknown; error: unknown }) {
  return {
    data: result.data,
    eq: vi.fn().mockReturnThis(),
    error: result.error,
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
}

describe('virtual terminal local sync helpers', () => {
  it('accepts ownership from the virtual_terminals row', async () => {
    const terminalChain = createChain({
      data: { id: 'terminal-1' },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => terminalChain),
    };

    await expect(
      verifyTerminalOwnership(supabase as never, 'merchant-1', 'VT_123')
    ).resolves.toBeNull();

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('virtual_terminals');
    expect(terminalChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(terminalChain.eq).toHaveBeenCalledWith('code', 'VT_123');
  });

  it('does not trust a writable legacy merchant virtual_terminal_code', async () => {
    const terminalChain = createChain({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => terminalChain),
    };

    const response = await verifyTerminalOwnership(
      supabase as never,
      'merchant-1',
      'VT_123'
    );

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toEqual({
      error: 'Terminal not found or not authorized',
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 response when modern ownership lookup fails', async () => {
    const supabase = {
      from: vi.fn(() =>
        createChain({ data: null, error: { message: 'boom' } })
      ),
    };

    const response = await verifyTerminalOwnership(
      supabase as never,
      'merchant-1',
      'VT_123'
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Database error verifying terminal ownership',
    });
  });

  it('syncs a provider-confirmed rename through the server-only RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 'terminal-1',
      error: null,
    });
    const supabase = {
      rpc,
    };

    await expect(
      syncTerminalRecord(
        'merchant-1',
        'VT_123',
        {
          accountName: 'Test Store',
          accountNumber: '1234567890',
          bank: 'Test Bank',
          name: 'Sales Terminal',
        },
        supabase as never
      )
    ).resolves.toBeNull();

    expect(rpc).toHaveBeenCalledWith('sync_virtual_terminal_local', {
      p_account_name: 'Test Store',
      p_account_number: '1234567890',
      p_active: null,
      p_bank: 'Test Bank',
      p_code: 'VT_123',
      p_merchant_id: 'merchant-1',
      p_name: 'Sales Terminal',
    });
  });

  it('uses the constrained RPC for terminal deactivation', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 'terminal-1',
      error: null,
    });
    const supabase = { rpc };

    await expect(
      syncTerminalRecord(
        'merchant-1',
        'VT_123',
        { active: false },
        supabase as never
      )
    ).resolves.toBeNull();

    expect(rpc).toHaveBeenCalledWith('sync_virtual_terminal_local', {
      p_account_name: null,
      p_account_number: null,
      p_active: false,
      p_bank: null,
      p_code: 'VT_123',
      p_merchant_id: 'merchant-1',
      p_name: null,
    });
  });

  it('returns a 500 response when the constrained sync RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'sync failed' },
    });
    const supabase = { rpc };

    const response = await syncTerminalRecord(
      'merchant-1',
      'VT_123',
      { name: 'Sales Terminal' },
      supabase as never
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Failed to sync Virtual Terminal locally',
    });
  });

  it('returns a 500 response when the sync RPC returns no terminal id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const supabase = { rpc };

    const response = await syncTerminalRecord(
      'merchant-1',
      'VT_123',
      { active: false },
      supabase as never
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Failed to sync Virtual Terminal locally',
    });
  });

  it('clears the legacy code through the admin client scoped to the merchant', async () => {
    // The `.eq('virtual_terminal_code', code)` filter reads a revoked secret
    // column, so it must run on the service-role admin client while staying
    // scoped to the owning merchant id.
    const chain = createChain({ data: null, error: null });
    const adminSupabase = { from: vi.fn(() => chain) };

    await expect(
      clearLegacyTerminalCode('merchant-1', 'VT_123', adminSupabase as never)
    ).resolves.toBeNull();

    expect(adminSupabase.from).toHaveBeenCalledWith('merchants');
    expect(chain.update).toHaveBeenCalledWith({ virtual_terminal_code: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(chain.eq).toHaveBeenCalledWith('virtual_terminal_code', 'VT_123');
  });

  it('defaults to the service-role admin client for the secret filter', async () => {
    const chain = createChain({ data: null, error: null });
    const adminFrom = vi.fn(() => chain);
    mockCreateAdminClient.mockReturnValue({ from: adminFrom });

    await expect(
      clearLegacyTerminalCode('merchant-1', 'VT_123')
    ).resolves.toBeNull();

    expect(mockCreateAdminClient).toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledWith('merchants');
  });

  it('returns a warning when clearing the legacy code fails', async () => {
    const adminSupabase = {
      from: vi.fn(() =>
        createChain({ data: null, error: { message: 'boom' } })
      ),
    };

    await expect(
      clearLegacyTerminalCode('merchant-1', 'VT_123', adminSupabase as never)
    ).resolves.toBe('legacy_clear_failed');
  });
});
