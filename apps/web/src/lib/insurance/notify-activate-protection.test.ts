import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const mockNotifyActivateProtection = vi.fn();
vi.mock('@/lib/expo-push', () => ({
  notifyActivateProtection: (...args: unknown[]) =>
    mockNotifyActivateProtection(...args),
}));

const SENT_OK = { sent: 1, failed: 0, errors: [] as string[] };

import { maybeNotifyActivateProtection } from './notify-activate-protection';

/**
 * Drive `supabase.from(...)` by a queue of results, consumed in call order.
 * Every chained builder method returns the same thenable so both
 * `await query` (array reads) and `query.maybeSingle()` resolve to the result.
 */
let resultQueue: Array<{ data: unknown; error?: unknown }>;

beforeEach(() => {
  vi.clearAllMocks();
  resultQueue = [];
  mockFrom.mockImplementation(() => {
    const result = resultQueue.shift() ?? { data: null, error: null };
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'not', 'update', 'in']) {
      query[method] = vi.fn(() => query);
    }
    query.maybeSingle = vi.fn(() => Promise.resolve(result));
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable so `await query` resolves the result.
    query.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject);
    return query;
  });
});

const PENDING_POLICY = { id: 'policy-1', status: 'active', claim_status: null };
const ORDER = {
  order_number: 'OG-1001',
  customer_id: 'cust-1',
  shipping_status: 'delivered',
};
const CUSTOMER = { user_id: 'user-1' };

describe('maybeNotifyActivateProtection', () => {
  it('sends the push once for a delivered order with a pending inspection', async () => {
    mockNotifyActivateProtection.mockResolvedValue(SENT_OK);
    resultQueue = [
      { data: ORDER }, // order lookup
      { data: [PENDING_POLICY] }, // candidate policies
      { data: CUSTOMER }, // customer lookup
      { data: { id: 'policy-1' } }, // claim succeeds
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).toHaveBeenCalledTimes(1);
    expect(mockNotifyActivateProtection).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      'OG-1001'
    );
  });

  it('passes the merchant scope to the protection push', async () => {
    mockNotifyActivateProtection.mockResolvedValue(SENT_OK);
    resultQueue = [
      { data: ORDER },
      { data: [PENDING_POLICY] },
      { data: CUSTOMER },
      { data: { id: 'policy-1' } },
    ];

    await maybeNotifyActivateProtection('order-1', 'merchant-1');

    expect(mockNotifyActivateProtection).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      'OG-1001',
      { merchantId: 'merchant-1' }
    );
  });

  it('does not nudge when the policy claim is already terminal (paid/declined)', async () => {
    resultQueue = [
      { data: ORDER },
      { data: [{ id: 'policy-1', status: 'active', claim_status: 'paid' }] },
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('does not nudge when the policy is no longer active', async () => {
    resultQueue = [
      { data: ORDER },
      { data: [{ id: 'policy-1', status: 'expired', claim_status: null }] },
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('releases the claim when the push is not delivered (retry stays open)', async () => {
    mockNotifyActivateProtection.mockResolvedValue({
      sent: 0,
      failed: 1,
      errors: ['no tokens'],
    });
    const releaseUpdate = vi.fn(() => ({
      in: vi.fn(() => Promise.resolve({})),
    }));
    resultQueue = [
      { data: ORDER },
      { data: [PENDING_POLICY] },
      { data: CUSTOMER },
      { data: { id: 'policy-1' } }, // claim succeeds
    ];
    // Capture the release update (the call AFTER the failed send).
    mockFrom.mockImplementation(() => {
      const result = resultQueue.shift();
      if (result === undefined) {
        return { update: releaseUpdate };
      }
      const query: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'not', 'update', 'in']) {
        query[m] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn(() => Promise.resolve(result));
      // biome-ignore lint/suspicious/noThenProperty: thenable test double for the supabase builder.
      query.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(result).then(res);
      return query;
    });

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).toHaveBeenCalledTimes(1);
    expect(releaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ activation_reminder_sent_at: null })
    );
  });

  it('releases the claim when the push sender rejects after claiming', async () => {
    mockNotifyActivateProtection.mockRejectedValue(new Error('push down'));
    const releaseUpdate = vi.fn(() => ({
      in: vi.fn(() => Promise.resolve({})),
    }));
    resultQueue = [
      { data: ORDER },
      { data: [PENDING_POLICY] },
      { data: CUSTOMER },
      { data: { id: 'policy-1' } },
    ];
    mockFrom.mockImplementation(() => {
      const result = resultQueue.shift();
      if (result === undefined) {
        return { update: releaseUpdate };
      }
      const query: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'not', 'update', 'in']) {
        query[m] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn(() => Promise.resolve(result));
      // biome-ignore lint/suspicious/noThenProperty: thenable test double for the supabase builder.
      query.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(result).then(res);
      return query;
    });

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).toHaveBeenCalledTimes(1);
    expect(releaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ activation_reminder_sent_at: null })
    );
  });

  it('does nothing when there is no pending, un-notified inspection policy', async () => {
    resultQueue = [{ data: ORDER }, { data: [] }];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('does not send when the claim is lost to a concurrent delivery (idempotent)', async () => {
    resultQueue = [
      { data: ORDER },
      { data: [PENDING_POLICY] },
      { data: CUSTOMER },
      { data: null }, // claim returns no row — already sent elsewhere
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('does not send when the customer has no app account (no user_id)', async () => {
    resultQueue = [
      { data: ORDER },
      { data: [PENDING_POLICY] },
      { data: { user_id: null } },
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('does not send when the order has no customer', async () => {
    resultQueue = [
      {
        data: {
          order_number: 'OG-1001',
          customer_id: null,
          shipping_status: 'delivered',
        },
      },
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });

  it('does not claim or notify before the order delivery state is persisted', async () => {
    resultQueue = [
      {
        data: {
          ...ORDER,
          shipping_status: 'shipped',
        },
      },
    ];

    await maybeNotifyActivateProtection('order-1');

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockNotifyActivateProtection).not.toHaveBeenCalled();
  });
});
