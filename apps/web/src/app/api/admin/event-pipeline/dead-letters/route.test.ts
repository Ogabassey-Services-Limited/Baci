import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), createClient: vi.fn() }));
vi.mock('@/lib/platform-admin-auth', () => ({
  getPlatformAdminAuth: mocks.auth,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { GET } from './route';

describe('GET /api/admin/event-pipeline/dead-letters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates before opening operator queries', async () => {
    mocks.auth.mockResolvedValue({ status: 'unauthenticated' });
    const response = await GET(
      new NextRequest('http://localhost/api/admin/event-pipeline/dead-letters')
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid operator filters', async () => {
    mocks.auth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'admin-1' },
    });
    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/event-pipeline/dead-letters?limit=101'
      )
    );

    expect(response.status).toBe(400);
  });

  it('uses the authenticated admin RPC surface for safe summaries', async () => {
    mocks.auth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'admin-1' },
    });
    const rpc = vi.fn((name: string) => {
      if (name === 'get_event_pipeline_operations_v1') {
        return Promise.resolve({
          data: {
            deliveries: [],
            heartbeats: [],
            queue: { queue_length: 0 },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { count: 0, items: [] }, error: null });
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/event-pipeline/dead-letters')
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'list_event_pipeline_ingress_failures_v1',
      expect.any(Object)
    );
  });

  it('returns 500 when an operator RPC fails', async () => {
    mocks.auth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'admin-1' },
    });
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'operator query failed' },
      }),
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/event-pipeline/dead-letters')
    );

    expect(response.status).toBe(500);
  });
});
