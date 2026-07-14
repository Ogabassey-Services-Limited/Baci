import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: { rpc: vi.fn() },
  enabled: true,
  record: vi.fn(),
}));

vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => mocks.enabled,
}));
vi.mock('@/lib/events/record-platform-domain-event', () => ({
  recordPlatformDomainEvent: mocks.record,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.admin,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

import { recordPlatformOrderCreatedEvent } from './record-platform-order-created-event';

describe('recordPlatformOrderCreatedEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.record.mockResolvedValue({ already_enqueued: false });
  });

  it('records a trusted, matchable platform purchase', async () => {
    await recordPlatformOrderCreatedEvent({
      currency: 'NGN',
      customerEmail: 'buyer@example.com',
      eventTimestamp: '2026-07-14T07:00:00.000Z',
      ipAddress: '203.0.113.1',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      orderNumber: 'BAC-1',
      userAgent: 'Baci test',
      value: 100,
    });

    expect(mocks.record).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({
        deliveryData: {
          email: 'buyer@example.com',
          ip: '203.0.113.1',
          ua: 'Baci test',
        },
        eventName: 'platform.platform_purchase.v1',
        externalEventId: 'platform_purchase:order-1',
        producer: 'worker',
        trustLevel: 'server',
      })
    );
  });

  it('does nothing before durable enqueue is enabled', async () => {
    mocks.enabled = false;

    await recordPlatformOrderCreatedEvent({
      currency: 'NGN',
      eventTimestamp: '2026-07-14T07:00:00.000Z',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      orderNumber: 'BAC-1',
      value: 100,
    });

    expect(mocks.record).not.toHaveBeenCalled();
  });
});
