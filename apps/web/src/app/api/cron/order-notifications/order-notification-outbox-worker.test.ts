import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock('@/lib/order-fulfillment-notification', () => ({
  sendOrderFulfillmentNotification: sendNotification,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import {
  createOrderNotificationCronSummary,
  processClaimedOrderNotificationRows,
} from './order-notification-outbox-worker';

function createSupabase(errors: unknown[]) {
  const eq = vi.fn();
  for (const error of errors) eq.mockResolvedValueOnce({ error });
  const builder = { update: vi.fn(() => builder), eq };
  return { client: { from: vi.fn(() => builder) }, builder };
}

const row = {
  attempt_count: 1,
  event_type: 'order_shipped' as const,
  id: '10000000-0000-4000-8000-000000000001',
  max_attempts: 5,
  merchant_id: '10000000-0000-4000-8000-000000000002',
  order_id: '10000000-0000-4000-8000-000000000003',
};

describe('order notification outbox worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('terminalizes a sent email as outcome-unknown when the sent marker write fails', async () => {
    const { client, builder } = createSupabase([
      { message: 'first write failed' },
      null,
    ]);
    sendNotification.mockResolvedValue({
      status: 'sent',
      messageId: 'message-1',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(client as never, [row], summary);

    expect(summary).toMatchObject({ sent: 1, retried: 0, skipped: 0 });
    expect(builder.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skip_reason: 'delivery_outcome_unknown',
        status: 'skipped',
      })
    );
  });
});
