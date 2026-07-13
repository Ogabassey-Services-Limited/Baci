import { describe, expect, it, vi } from 'vitest';
import { recordPlatformDomainEvent } from './record-platform-domain-event';

describe('recordPlatformDomainEvent', () => {
  it('uses one atomic recording RPC and strips URL query data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          already_enqueued: false,
          domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
          queue_message_id: 9,
        },
      ],
      error: null,
    });

    await recordPlatformDomainEvent({ rpc } as never, {
      eventData: { page_url: 'https://usebaci.com/?email=person@example.com' },
      eventName: 'platform.client.observed.v1',
      eventTimestamp: '2026-07-12T12:00:00.000Z',
      eventType: 'landing_page_view',
      externalEventId: 'event-1',
      pageUrl: 'https://usebaci.com/?token=secret',
      referrer: 'https://example.com/?email=person@example.com',
      trustLevel: 'anonymous_client',
    });

    expect(rpc).toHaveBeenCalledWith(
      'record_platform_domain_event_v1',
      expect.objectContaining({
        p_event_data: { page_url: 'https://usebaci.com/' },
        p_page_url: 'https://usebaci.com/',
        p_referrer: 'https://example.com/',
      })
    );
  });

  it('rejects when the platform recording RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(
      recordPlatformDomainEvent({ rpc } as never, {
        eventData: {},
        eventName: 'platform.client.observed.v1',
        eventTimestamp: '2026-07-12T12:00:00.000Z',
        eventType: 'landing_page_view',
        externalEventId: 'event-1',
        trustLevel: 'anonymous_client',
      })
    ).rejects.toThrow('durable_platform_enqueue_failed');
  });

  it('rejects an invalid durable enqueue RPC response', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ domain_event_id: 'not-a-result' }],
      error: null,
    });

    await expect(
      recordPlatformDomainEvent({ rpc } as never, {
        eventData: {},
        eventName: 'platform.client.observed.v1',
        eventTimestamp: '2026-07-12T12:00:00.000Z',
        eventType: 'landing_page_view',
        externalEventId: 'event-1',
        trustLevel: 'anonymous_client',
      })
    ).rejects.toThrow('durable_platform_enqueue_invalid');
  });
});
