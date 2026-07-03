import { describe, expect, it, vi } from 'vitest';
import {
  clearLegacyTerminalCode,
  syncTerminalRecord,
  verifyTerminalOwnership,
} from './virtual-terminal-local-sync';

function createChain(result: unknown) {
  return {
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
}

describe('virtual terminal local sync helpers', () => {
  it('returns a 500 response when ownership lookup fails', async () => {
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

  it('backfills a missing virtual terminal row after a Paystack update succeeds', async () => {
    const updateChain = createChain({ data: null, error: null });
    const insertChain = createChain({
      data: { id: 'terminal-1' },
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => updateChain),
        insert: vi.fn(() => insertChain),
      })),
    };

    await expect(
      syncTerminalRecord(supabase as never, 'merchant-1', 'VT_123', {
        name: 'Sales Terminal',
      })
    ).resolves.toBeNull();

    expect(insertChain.insert).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('virtual_terminals');
  });

  it('returns a warning when legacy clear matches no merchant row', async () => {
    const supabase = {
      from: vi.fn(() => createChain({ data: null, error: null })),
    };

    await expect(
      clearLegacyTerminalCode(supabase as never, 'merchant-1', 'VT_123')
    ).resolves.toBe('legacy_code_not_cleared');
  });
});
