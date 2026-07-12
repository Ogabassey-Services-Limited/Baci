import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), record: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => true,
  isLegacyAnalyticsFanoutDisabled: () => true,
}));
vi.mock('@/lib/events/record-platform-domain-event', () => ({
  recordPlatformDomainEvent: mocks.record,
}));

import { POST } from './route';

describe('POST /api/platform/events durable pipeline', () => {
  it('routes allowlisted low-risk public telemetry without elevating trust', async () => {
    mocks.record.mockResolvedValue({ queue_message_id: 1 });
    const response = await POST(
      new NextRequest('https://usebaci.com/api/platform/events', {
        body: JSON.stringify({
          event_type: 'landing_page_view',
          page_url: 'https://usebaci.com/',
        }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event_id).toMatch(/^platform_/);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventName: 'platform.landing_page_view.v1',
        trustLevel: 'anonymous_client',
      })
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
