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

  it('marks successful sends as sent while preserving existing metadata', async () => {
    const { client, builder } = createSupabase([null]);
    sendNotification.mockResolvedValue({
      status: 'sent',
      messageId: 'message-1',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(
      client as never,
      [{ ...row, metadata: { source: 'shipping_status_trigger' } }],
      summary
    );

    expect(summary).toMatchObject({ sent: 1, retried: 0, skipped: 0 });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          source: 'shipping_status_trigger',
          message_id: 'message-1',
        },
        status: 'sent',
      })
    );
  });

  it('marks skipped notification results as skipped', async () => {
    const { client, builder } = createSupabase([null]);
    sendNotification.mockResolvedValue({
      status: 'skipped',
      reason: 'missing_customer_email',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(client as never, [row], summary);

    expect(summary).toMatchObject({ skipped: 1, retried: 0, sent: 0 });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        skip_reason: 'missing_customer_email',
        status: 'skipped',
      })
    );
  });

  it('reschedules known failures while attempts remain', async () => {
    const { client, builder } = createSupabase([null]);
    sendNotification.mockResolvedValue({
      status: 'failed',
      error: 'provider unavailable',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(client as never, [row], summary);

    expect(summary).toMatchObject({ failed: 0, retried: 1 });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: 'provider unavailable',
        status: 'pending',
      })
    );
  });

  it('marks known failures terminal after the final attempt', async () => {
    const { client, builder } = createSupabase([null]);
    sendNotification.mockResolvedValue({
      status: 'failed',
      error: 'provider unavailable',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(
      client as never,
      [{ ...row, attempt_count: row.max_attempts }],
      summary
    );

    expect(summary).toMatchObject({ failed: 1, retried: 0 });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('never retries an ambiguous provider delivery outcome', async () => {
    const { client, builder } = createSupabase([null]);
    sendNotification.mockResolvedValue({
      status: 'failed',
      deliveryOutcome: 'unknown',
      error: 'request timed out',
    });
    const summary = createOrderNotificationCronSummary(1);

    await processClaimedOrderNotificationRows(client as never, [row], summary);

    expect(summary).toMatchObject({ skipped: 1, retried: 0 });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        skip_reason: 'delivery_outcome_unknown',
        status: 'skipped',
      })
    );
  });

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
