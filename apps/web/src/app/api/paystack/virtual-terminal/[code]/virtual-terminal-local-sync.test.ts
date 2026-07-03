import { describe, expect, it, vi } from 'vitest';
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

  it('falls back to the legacy merchant virtual_terminal_code', async () => {
    const terminalChain = createChain({ data: null, error: null });
    const merchantChain = createChain({
      data: { virtual_terminal_code: 'VT_123' },
      error: null,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(terminalChain)
        .mockReturnValueOnce(merchantChain),
    };

    await expect(
      verifyTerminalOwnership(supabase as never, 'merchant-1', 'VT_123')
    ).resolves.toBeNull();

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'virtual_terminals');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'merchants');
  });

  it('returns 404 when neither modern nor legacy ownership matches', async () => {
    const terminalChain = createChain({ data: null, error: null });
    const merchantChain = createChain({
      data: { virtual_terminal_code: 'VT_OTHER' },
      error: null,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(terminalChain)
        .mockReturnValueOnce(merchantChain),
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

  it('returns a 500 response when legacy ownership lookup fails', async () => {
    const terminalChain = createChain({ data: null, error: null });
    const merchantChain = createChain({
      data: null,
      error: { message: 'boom' },
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(terminalChain)
        .mockReturnValueOnce(merchantChain),
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

  it('backfills a missing virtual terminal row after a Paystack update succeeds', async () => {
    const updateChain = createChain({ data: null, error: null });
    const insertChain = createChain({
      data: { id: 'terminal-1' },
      error: null,
    });
    const update = vi.fn(() => updateChain);
    const insert = vi.fn(() => insertChain);
    const supabase = {
      from: vi.fn(() => ({ insert, update })),
    };

    await expect(
      syncTerminalRecord(supabase as never, 'merchant-1', 'VT_123', {
        name: 'Sales Terminal',
      })
    ).resolves.toBeNull();

    expect(update).toHaveBeenCalledWith({ name: 'Sales Terminal' });
    expect(insert).toHaveBeenCalledWith({
      active: true,
      code: 'VT_123',
      merchant_id: 'merchant-1',
      name: 'Sales Terminal',
      payment_link: 'https://paystack.com/vt/VT_123',
    });
    expect(supabase.from).toHaveBeenCalledWith('virtual_terminals');
  });

  it('returns a 500 response when updating the local terminal row fails', async () => {
    const updateChain = createChain({
      data: null,
      error: { message: 'update failed' },
    });
    const update = vi.fn(() => updateChain);
    const supabase = {
      from: vi.fn(() => ({ update })),
    };

    const response = await syncTerminalRecord(
      supabase as never,
      'merchant-1',
      'VT_123',
      { name: 'Sales Terminal' }
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Failed to sync Virtual Terminal locally',
    });
  });

  it('returns a 500 response when backfilling a missing terminal row fails', async () => {
    const updateChain = createChain({ data: null, error: null });
    const insertChain = createChain({
      data: null,
      error: { message: 'insert failed' },
    });
    const update = vi.fn(() => updateChain);
    const insert = vi.fn(() => insertChain);
    const supabase = {
      from: vi.fn(() => ({ insert, update })),
    };

    const response = await syncTerminalRecord(
      supabase as never,
      'merchant-1',
      'VT_123',
      { active: false }
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'Failed to sync Virtual Terminal locally',
    });
    expect(insert).toHaveBeenCalledWith({
      active: false,
      code: 'VT_123',
      merchant_id: 'merchant-1',
      name: 'Legacy Virtual Terminal',
      payment_link: 'https://paystack.com/vt/VT_123',
    });
  });

  it('does not warn when a legacy clear matches no merchant row', async () => {
    const supabase = {
      from: vi.fn(() => createChain({ data: null, error: null })),
    };

    await expect(
      clearLegacyTerminalCode(supabase as never, 'merchant-1', 'VT_123')
    ).resolves.toBeNull();
  });

  it('returns a warning when clearing the legacy code fails', async () => {
    const supabase = {
      from: vi.fn(() =>
        createChain({ data: null, error: { message: 'boom' } })
      ),
    };

    await expect(
      clearLegacyTerminalCode(supabase as never, 'merchant-1', 'VT_123')
    ).resolves.toBe('legacy_clear_failed');
  });
});
