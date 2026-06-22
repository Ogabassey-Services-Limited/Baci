import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { JumiaOrderSyncResult } from '@/lib/jumia/order-sync-result';
import {
  type JumiaSyncCursorUpdateError,
  persistJumiaSyncCursor,
} from './order-sync-cursor';
import type { MarketplaceIntegrationRow } from './order-sync-mappers';
import { MAX_FULL_FAILURES_BEFORE_ADVANCE } from './order-sync-state';

function createIntegration(
  overrides: Partial<MarketplaceIntegrationRow> = {}
): MarketplaceIntegrationRow {
  return {
    id: 'integration-1',
    merchant_id: 'merchant-1',
    shop_id: 'shop-1',
    last_sync_at: '2026-06-22T10:00:00.000Z',
    sync_config: { orders: true },
    ...overrides,
  } as MarketplaceIntegrationRow;
}

function createResult(orderErrors: number): JumiaOrderSyncResult {
  return {
    canonicalCreated: 0,
    canonicalUpdated: 0,
    errors: [],
    integrations: 1,
    notified: 0,
    orderErrors,
    synced: 0,
  };
}

function createUpdateClient(error: { message: string } | null = null) {
  const eq = vi.fn(() => Promise.resolve({ error }));
  const update = vi.fn(() => ({ eq }));
  const client = {
    from: vi.fn(() => ({ update })),
  } as unknown as SupabaseClient;
  return { client, eq, update };
}

describe('persistJumiaSyncCursor', () => {
  it('parks the cursor at the earliest failed order after partial progress', async () => {
    const { client, update } = createUpdateClient();

    await persistJumiaSyncCursor({
      earliestFailedSyncAt: '2026-06-22T10:05:00.000Z',
      integration: createIntegration(),
      orderErrorsBefore: 0,
      result: createResult(1),
      supabase: client,
      syncStartedAt: '2026-06-22T11:00:00.000Z',
      syncedAnyOrder: true,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_sync_at: '2026-06-22T10:05:00.000Z',
        sync_error: expect.stringContaining('cursor parked'),
      })
    );
  });

  it('advances the cursor only after the full-failure retry threshold', async () => {
    const { client, update } = createUpdateClient();

    await persistJumiaSyncCursor({
      earliestFailedSyncAt: null,
      integration: createIntegration({
        sync_config: {
          jumia_full_failure: {
            count: MAX_FULL_FAILURES_BEFORE_ADVANCE - 1,
            cursor: '2026-06-22T10:00:00.000Z',
          },
        },
      }),
      orderErrorsBefore: 0,
      result: createResult(3),
      supabase: client,
      syncStartedAt: '2026-06-22T11:00:00.000Z',
      syncedAnyOrder: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_sync_at: '2026-06-22T11:00:00.000Z',
        sync_error: expect.stringContaining('cursor advanced'),
      })
    );
  });

  it('throws a typed error with the attempted cursor update when persistence fails', async () => {
    const { client } = createUpdateClient({ message: 'permission denied' });

    await expect(
      persistJumiaSyncCursor({
        earliestFailedSyncAt: null,
        integration: createIntegration(),
        orderErrorsBefore: 0,
        result: createResult(0),
        supabase: client,
        syncStartedAt: '2026-06-22T11:00:00.000Z',
        syncedAnyOrder: false,
      })
    ).rejects.toMatchObject({
      name: 'JumiaSyncCursorUpdateError',
      syncUpdate: expect.objectContaining({
        last_sync_at: '2026-06-22T11:00:00.000Z',
      }),
    } satisfies Partial<JumiaSyncCursorUpdateError>);
  });
});
