import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  legacyFanoutDisabled: true,
  record: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: mocks.upsert }) }),
}));
vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => true,
  isLegacyAnalyticsFanoutDisabled: () => mocks.legacyFanoutDisabled,
}));
vi.mock('@/lib/events/record-platform-domain-event', () => ({
  recordPlatformDomainEvent: mocks.record,
}));

import { POST } from './route';

describe('POST /api/platform/events durable pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyFanoutDisabled = true;
  });

  it('falls back to legacy persistence when durable enqueue fails during shadow mode', async () => {
    mocks.legacyFanoutDisabled = false;
    mocks.record.mockRejectedValueOnce(new Error('queue unavailable'));
    mocks.upsert.mockResolvedValueOnce({ error: null });

    const response = await POST(
      new NextRequest('https://usebaci.com/api/platform/events', {
        body: JSON.stringify({
          event_id: 'platform-event-1',
          event_type: 'landing_page_view',
        }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'platform-event-1',
        event_type: 'landing_page_view',
      }),
      { ignoreDuplicates: true, onConflict: 'event_type,event_id' }
    );
  });

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
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
