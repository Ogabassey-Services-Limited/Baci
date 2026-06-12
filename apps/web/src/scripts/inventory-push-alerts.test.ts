import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  notifyLowStock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/expo-push', () => ({
  notifyLowStock: mocks.notifyLowStock,
}));

import {
  InventoryPushAlertsError,
  runInventoryPushAlertsCli,
  sendInventoryPushAlerts,
} from './inventory-push-alerts';

function createSupabaseMock({
  alerts = [],
  queryError = null,
  updateError = null,
}: {
  alerts?: unknown[];
  queryError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const calls: unknown[] = [];
  const supabase = {
    from(table: string) {
      calls.push({ table });
      return {
        select(columns: string) {
          calls.push({ columns });
          return {
            eq(column: string, value: unknown) {
              calls.push({ column, operation: 'eq', value });
              return {
                eq(nextColumn: string, nextValue: unknown) {
                  calls.push({
                    column: nextColumn,
                    operation: 'eq',
                    value: nextValue,
                  });
                  return {
                    order(orderColumn: string, orderOptions: unknown) {
                      calls.push({
                        column: orderColumn,
                        operation: 'order',
                        options: orderOptions,
                      });
                      return {
                        limit(limitValue: number) {
                          calls.push({ operation: 'limit', value: limitValue });
                          return Promise.resolve({
                            data: alerts,
                            error: queryError,
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        update(values: unknown) {
          calls.push({ operation: 'update', values });
          return {
            eq(column: string, value: unknown) {
              calls.push({ column, operation: 'eq', value });
              return Promise.resolve({ error: updateError });
            },
          };
        },
      };
    },
  };

  return { calls, supabase };
}

function updateCallCount(calls: unknown[]) {
  return calls.filter(
    (call) =>
      typeof call === 'object' &&
      call !== null &&
      'operation' in call &&
      call.operation === 'update'
  ).length;
}

describe('sendInventoryPushAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a no-op summary when there are no active unnotified alerts', async () => {
    const mock = createSupabaseMock();

    const summary = await sendInventoryPushAlerts({
      logger: { error: vi.fn(), log: vi.fn() },
      supabase: mock.supabase as never,
    });

    expect(summary).toEqual({
      message: 'No new alerts to notify',
      sent: 0,
      success: true,
    });
    expect(mocks.notifyLowStock).not.toHaveBeenCalled();
  });

  it('sends low-stock notifications and marks alerts as notified', async () => {
    const mock = createSupabaseMock({
      alerts: [
        {
          id: 'alert-1',
          merchant_id: 'merchant-1',
          current_stock: 2,
          threshold: 5,
          products: { id: 'product-1', name: 'iPhone 15' },
        },
        {
          id: 'alert-2',
          merchant_id: 'merchant-2',
          current_stock: 1,
          threshold: null,
          products: [{ id: 'product-2', name: 'Galaxy S24' }],
        },
      ],
    });
    mocks.notifyLowStock.mockResolvedValue(undefined);

    const summary = await sendInventoryPushAlerts({
      logger: { error: vi.fn(), log: vi.fn() },
      supabase: mock.supabase as never,
    });

    expect(summary).toEqual({
      failed: 0,
      sent: 2,
      success: true,
      total: 2,
    });
    expect(mocks.notifyLowStock).toHaveBeenNthCalledWith(
      1,
      'merchant-1',
      'product-1',
      'iPhone 15',
      2,
      5
    );
    expect(mocks.notifyLowStock).toHaveBeenNthCalledWith(
      2,
      'merchant-2',
      'product-2',
      'Galaxy S24',
      1,
      5
    );
    expect(updateCallCount(mock.calls)).toBe(2);
  });

  it('continues processing when one notification fails', async () => {
    const mock = createSupabaseMock({
      alerts: [
        {
          id: 'alert-1',
          merchant_id: 'merchant-1',
          current_stock: 2,
          threshold: 5,
          products: null,
        },
        {
          id: 'alert-2',
          merchant_id: 'merchant-2',
          current_stock: 1,
          threshold: 3,
          products: { id: 'product-2', name: 'Galaxy S24' },
        },
      ],
    });
    mocks.notifyLowStock
      .mockRejectedValueOnce(new Error('Expo unavailable'))
      .mockResolvedValueOnce(undefined);

    const summary = await sendInventoryPushAlerts({
      logger: { error: vi.fn(), log: vi.fn() },
      supabase: mock.supabase as never,
    });

    expect(summary).toEqual({
      failed: 1,
      sent: 1,
      success: true,
      total: 2,
    });
    expect(mocks.notifyLowStock).toHaveBeenCalledTimes(2);
  });

  it('throws a client-safe error when alert lookup fails', async () => {
    const mock = createSupabaseMock({
      queryError: { message: 'database unavailable' },
    });

    await expect(
      sendInventoryPushAlerts({
        logger: { error: vi.fn(), log: vi.fn() },
        supabase: mock.supabase as never,
      })
    ).rejects.toMatchObject({
      clientMessage: 'Failed to fetch alerts',
      message: 'Failed to fetch alerts: database unavailable',
    } satisfies Partial<InventoryPushAlertsError>);
  });
});

describe('runInventoryPushAlertsCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns non-zero when any alert notification fails', async () => {
    const mock = createSupabaseMock({
      alerts: [
        {
          id: 'alert-1',
          merchant_id: 'merchant-1',
          current_stock: 2,
          threshold: 5,
          products: null,
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.createAdminClient.mockReturnValue(mock.supabase);
    mocks.notifyLowStock.mockRejectedValue(new Error('Expo unavailable'));

    const exitCode = await runInventoryPushAlertsCli();
    const jsonLog = logSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.trim().startsWith('{'));

    expect(exitCode).toBe(1);
    expect(JSON.parse(jsonLog ?? '{}')).toMatchObject({
      failed: 1,
      sent: 0,
      total: 1,
    });
  });
});
